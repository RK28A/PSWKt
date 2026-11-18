/*
 * PSWKT - Persistance locale des sessions (IndexedDB, repli memoire/localStorage)
 * -----------------------------------------------------------------------------
 * Objectif : garder les resultats SANS serveur (compatible hebergement statique
 * type InfinityFree). Chaque lancement cree une NOUVELLE session. Avant chaque
 * test, un marqueur "test en cours" est ecrit ; apres, le resultat complet est
 * enregistre et le marqueur efface. Si le navigateur plante, au rechargement la
 * session reste en etat "running" et son marqueur nomme le dernier test lance
 * -> on identifie le test fautif, meme sans serveur.
 *
 * ATTENTION (honnete) : IndexedDB ecrit de maniere ASYNCHRONE. Un gel total du
 * navigateur juste apres l'ecriture peut la perdre avant qu'elle n'atteigne le
 * disque. C'est du "meilleur effort" : fiable dans l'immense majorite des cas,
 * mais sans garantie absolue sur un crash brutal (voir aussi the optional PHP log endpoints).
 *
 * API (toutes les methodes renvoient une Promise) :
 *   store.ready            -> Promise<bool> (true si IndexedDB, false si repli)
 *   store.createSession(meta) -> sessionId
 *   store.markRunning(sessionId, test) -> ecrit le marqueur "en cours"
 *   store.saveRecord(sessionId, record) -> ajoute un resultat, efface le marqueur
 *   store.finishSession(sessionId, summary, aborted) -> clot la session
 *   store.listSessions() -> [ {id, startedAt, finishedAt, label, mode, status, summary, ua} ]
 *   store.getSession(id) / store.getRecords(id) / store.deleteSession(id)
 *   store.findInterrupted() -> sessions restees "running" (crash probable)
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  var DB_NAME = 'pswkt';
  var DB_VERSION = 1;

  function nowIso() { try { return new Date().toISOString(); } catch (e) { return '' + Date.now(); } }
  function uid() {
    var r = (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6));
    return 's-' + Date.now().toString(36) + '-' + r;
  }

  // ---------------------------------------------------------------------------
  // Backend IndexedDB
  // ---------------------------------------------------------------------------
  function idbBackend() {
    var IDB = global.indexedDB || global.webkitIndexedDB || global.mozIndexedDB;
    if (!IDB) return null;
    var dbP = null;

    function open() {
      if (dbP) return dbP;
      dbP = new Promise(function (resolve, reject) {
        var req;
        try { req = IDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result;
          if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('records')) {
            var rs = db.createObjectStore('records', { keyPath: 'rid', autoIncrement: true });
            rs.createIndex('session', 'session', { unique: false });
          }
          if (!db.objectStoreNames.contains('running')) db.createObjectStore('running', { keyPath: 'session' });
        };
        req.onsuccess = function (ev) { resolve(ev.target.result); };
        req.onerror = function () { reject(req.error || new Error('IndexedDB open error')); };
        req.onblocked = function () { reject(new Error('IndexedDB bloque')); };
      });
      return dbP;
    }

    function tx(stores, mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(stores, mode);
          var out;
          t.oncomplete = function () { resolve(out); };
          t.onerror = function () { reject(t.error || new Error('tx error')); };
          t.onabort = function () { reject(t.error || new Error('tx abort')); };
          try { out = fn(t); } catch (e) { try { t.abort(); } catch (x) {} reject(e); }
        });
      });
    }
    function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }

    return {
      kind: 'indexeddb',
      createSession: function (sess) {
        return tx(['sessions'], 'readwrite', function (t) { t.objectStore('sessions').put(sess); }).then(function () { return sess.id; });
      },
      markRunning: function (sessionId, mark) {
        return tx(['running'], 'readwrite', function (t) { t.objectStore('running').put({ session: sessionId, test: mark, at: nowIso() }); });
      },
      saveRecord: function (sessionId, record) {
        var row = {}; for (var k in record) if (record.hasOwnProperty(k)) row[k] = record[k];
        row.session = sessionId; row.savedAt = nowIso();
        return tx(['records', 'running'], 'readwrite', function (t) {
          t.objectStore('records').add(row);
          t.objectStore('running').delete(sessionId); // le resultat est arrive : plus "en cours"
        });
      },
      finishSession: function (sessionId, patch) {
        return tx(['sessions', 'running'], 'readwrite', function (t) {
          var st = t.objectStore('sessions');
          var g = st.get(sessionId);
          g.onsuccess = function () {
            var s = g.result || { id: sessionId };
            for (var k in patch) if (patch.hasOwnProperty(k)) s[k] = patch[k];
            st.put(s);
          };
          t.objectStore('running').delete(sessionId);
        });
      },
      listSessions: function () {
        return tx(['sessions'], 'readonly', function () {}).then(function () {
          return open().then(function (db) {
            return new Promise(function (resolve, reject) {
              var out = [];
              var t = db.transaction(['sessions'], 'readonly');
              var cur = t.objectStore('sessions').openCursor();
              cur.onsuccess = function (ev) { var c = ev.target.result; if (c) { out.push(c.value); c.continue(); } };
              cur.onerror = function () { reject(cur.error); };
              t.oncomplete = function () { out.sort(function (a, b) { return (b.startedAt || '').localeCompare(a.startedAt || ''); }); resolve(out); };
            });
          });
        });
      },
      getSession: function (id) { return open().then(function (db) { return reqP(db.transaction(['sessions'], 'readonly').objectStore('sessions').get(id)); }); },
      getRunning: function (id) { return open().then(function (db) { return reqP(db.transaction(['running'], 'readonly').objectStore('running').get(id)); }); },
      getRecords: function (id) {
        return open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var out = [];
            var t = db.transaction(['records'], 'readonly');
            var idx = t.objectStore('records').index('session');
            var cur = idx.openCursor(IDBKeyRange.only(id));
            cur.onsuccess = function (ev) { var c = ev.target.result; if (c) { out.push(c.value); c.continue(); } };
            cur.onerror = function () { reject(cur.error); };
            t.oncomplete = function () { resolve(out); };
          });
        });
      },
      deleteSession: function (id) {
        return open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var t = db.transaction(['sessions', 'records', 'running'], 'readwrite');
            t.objectStore('sessions').delete(id);
            t.objectStore('running').delete(id);
            var idx = t.objectStore('records').index('session');
            var cur = idx.openCursor(IDBKeyRange.only(id));
            cur.onsuccess = function (ev) { var c = ev.target.result; if (c) { c.delete(); c.continue(); } };
            t.oncomplete = function () { resolve(true); };
            t.onerror = function () { reject(t.error); };
          });
        });
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Backend de repli : memoire + miroir compact dans localStorage (meilleur effort)
  // ---------------------------------------------------------------------------
  function memBackend() {
    var sessions = {}; var records = {}; var running = {};
    var LS = (function () { try { var k = '__pswkt_probe'; global.localStorage.setItem(k, '1'); global.localStorage.removeItem(k); return global.localStorage; } catch (e) { return null; } })();
    function persistIndex() {
      if (!LS) return;
      try {
        var idx = [];
        for (var id in sessions) if (sessions.hasOwnProperty(id)) idx.push(sessions[id]);
        LS.setItem('pswkt_sessions', JSON.stringify(idx).slice(0, 500000));
      } catch (e) {}
    }
    if (LS) { try { var raw = LS.getItem('pswkt_sessions'); if (raw) { var arr = JSON.parse(raw); for (var i = 0; i < arr.length; i++) sessions[arr[i].id] = arr[i]; } } catch (e) {} }
    return {
      kind: LS ? 'memory+localStorage' : 'memory',
      createSession: function (s) { sessions[s.id] = s; records[s.id] = []; persistIndex(); return Promise.resolve(s.id); },
      markRunning: function (id, mark) { running[id] = { session: id, test: mark, at: nowIso() }; return Promise.resolve(); },
      saveRecord: function (id, rec) { (records[id] = records[id] || []).push(rec); delete running[id]; return Promise.resolve(); },
      finishSession: function (id, patch) { var s = sessions[id] || { id: id }; for (var k in patch) if (patch.hasOwnProperty(k)) s[k] = patch[k]; sessions[id] = s; delete running[id]; persistIndex(); return Promise.resolve(); },
      listSessions: function () { var out = []; for (var id in sessions) if (sessions.hasOwnProperty(id)) out.push(sessions[id]); out.sort(function (a, b) { return (b.startedAt || '').localeCompare(a.startedAt || ''); }); return Promise.resolve(out); },
      getSession: function (id) { return Promise.resolve(sessions[id] || null); },
      getRunning: function (id) { return Promise.resolve(running[id] || null); },
      getRecords: function (id) { return Promise.resolve((records[id] || []).slice()); },
      deleteSession: function (id) { delete sessions[id]; delete records[id]; delete running[id]; persistIndex(); return Promise.resolve(true); }
    };
  }

  // ---------------------------------------------------------------------------
  // Façade publique
  // ---------------------------------------------------------------------------
  var backend = null, backendKind = 'none';
  var readyP = (function () {
    var idb = null;
    try { idb = idbBackend(); } catch (e) { idb = null; }
    if (idb) {
      // Verifie reellement l'ouverture ; sinon repli.
      return idb.listSessions().then(function () { backend = idb; backendKind = idb.kind; return true; },
        function () { backend = memBackend(); backendKind = backend.kind; return false; });
    }
    backend = memBackend(); backendKind = backend.kind;
    return Promise.resolve(false);
  })();

  function withBackend(fn) { return readyP.then(function () { return fn(backend); }); }

  var store = {
    ready: readyP,
    get kind() { return backendKind; },
    newId: uid,
    createSession: function (meta) {
      var s = {
        id: (meta && meta.id) || uid(),
        startedAt: nowIso(),
        finishedAt: null,
        label: (meta && meta.label) || '',
        mode: (meta && meta.mode) || 'diagnostic',
        ua: (global.navigator && global.navigator.userAgent) || '',
        status: 'running',
        summary: null
      };
      return withBackend(function (b) { return b.createSession(s); }).then(function () { return s; });
    },
    markRunning: function (id, mark) { return withBackend(function (b) { return b.markRunning(id, mark); }); },
    saveRecord: function (id, rec) { return withBackend(function (b) { return b.saveRecord(id, rec); }); },
    finishSession: function (id, summary, aborted) {
      return withBackend(function (b) { return b.finishSession(id, { finishedAt: nowIso(), status: aborted ? 'interrupted' : 'done', summary: summary }); });
    },
    listSessions: function () { return withBackend(function (b) { return b.listSessions(); }); },
    getSession: function (id) { return withBackend(function (b) { return b.getSession(id); }); },
    getRunning: function (id) { return withBackend(function (b) { return b.getRunning(id); }); },
    getRecords: function (id) { return withBackend(function (b) { return b.getRecords(id); }); },
    deleteSession: function (id) { return withBackend(function (b) { return b.deleteSession(id); }); },
    // Sessions restees "running" = interrompues (crash probable) lors d'un run precedent.
    findInterrupted: function () {
      return this.listSessions().then(function (list) {
        return list.filter(function (s) { return s.status === 'running'; });
      });
    }
  };

  PSWKT.store = store;

})(typeof window !== 'undefined' ? window : this);
