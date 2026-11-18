/*
 * PSWKT - Enregistrement CONTINU sur le serveur (anti-perte sur crash)
 * -----------------------------------------------------------------------------
 * Probleme : si le navigateur PS5 plante pendant un test, tout le journal en
 * memoire disparait. Solution : on envoie le journal au serveur AU FUR ET A
 * MESURE (chaque evenement, chaque debut/fin de test), et le serveur force
 * l'ecriture disque (fsync) a chaque reception. Resultat : apres un crash, le
 * fichier logs/pswkt-live-<session>.txt contient TOUT jusqu'au test fautif,
 * dont la ligne "▶ DEBUT <id>" ecrite juste AVANT son execution -> on sait
 * exactement quel test a fait tomber WebKit.
 *
 * Deux voies d'envoi :
 *   - asynchrone (par defaut) : ne ralentit pas l'UI ;
 *   - SYNCHRONE (sync=true) : bloque jusqu'a confirmation du serveur. Utilise
 *     pour les marqueurs critiques (debut de test, jalons des tests agressifs)
 *     afin de garantir la persistance AVANT l'operation qui peut tout figer.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  var serverLog = {
    enabled: false,
    session: null,
    buffer: [],
    bytesSent: 0,
    lastError: null,
    _unsub: null,

    // Qualifie le role d'un evenement : action tentee vs reaction mesuree du moteur.
    _role: function (level) {
      if (level === 'info') return 'ACTION ';
      if (level === 'metric') return 'REACTION';
      if (level === 'error') return 'ERREUR ';
      if (level === 'warn') return 'ALERTE ';
      if (level === 'pass') return 'FIN-OK ';
      if (level === 'fail') return 'FIN-KO ';
      return ((level || '').toUpperCase() + '       ').slice(0, 7);
    },

    // Formate un evenement du journal en une ligne ultra-detaillee.
    format: function (e) {
      var t = ('            ' + (e.t != null ? e.t.toFixed(3) : '?')).slice(-12);
      var line = '[' + t + 'ms][' + (e.iso || '') + '] ' + this._role(e.level) + ' [' + e.source + '] ' + e.msg;
      if (e.data !== undefined) {
        try { line += '\n        └─ ' + JSON.stringify(e.data); } catch (x) { line += '\n        └─ [illisible]'; }
      }
      return line;
    },

    _post: function (text, extraQuery, sync) {
      try {
        var xhr = new XMLHttpRequest();
        var url = '/api/log-stream?session=' + encodeURIComponent(this.session || 'session') + (extraQuery || '');
        xhr.open('POST', url, !sync);            // async = !sync
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        var self = this;
        if (!sync) {
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && !(xhr.status >= 200 && xhr.status < 300)) {
              self.lastError = 'statut ' + xhr.status;
            }
          };
          xhr.onerror = function () { self.lastError = 'serveur injoignable'; };
        }
        xhr.send(text);
        if (sync && !(xhr.status >= 200 && xhr.status < 300)) {
          this.lastError = 'statut ' + xhr.status;
          return false;
        }
        this.bytesSent += text.length;
        return true;
      } catch (e) {
        this.lastError = e && e.message ? e.message : String(e);
        return false;
      }
    },

    // Demarre une session : cree/tronque le fichier et s'abonne au journal.
    enable: function (sessionName) {
      this.session = sessionName || ('run-' + Date.now());
      this.enabled = true;
      this.buffer.length = 0;
      this.bytesSent = 0;
      this.lastError = null;
      var header = '################################################################\n' +
        '# PSWKT - journal CONTINU ultra-detaille\n' +
        '# session : ' + this.session + '\n' +
        '# debut   : ' + PSWKT.isoStamp() + '\n' +
        '# UA      : ' + ((global.navigator && global.navigator.userAgent) || '?') + '\n' +
        '# NOTE : fichier ecrit au fil de l eau (fsync). En cas de crash du\n' +
        '#        navigateur, la DERNIERE ligne "DEBUT" indique le test fautif.\n' +
        '################################################################\n';
      var ok = this._post(header, '&init=1', true);   // init=1 => tronque/cree
      var self = this;
      if (!this._unsub) {
        this._unsub = PSWKT.logger.subscribe(function (p) {
          if (!self.enabled) return;
          if (p.type === 'event') self.buffer.push(self.format(p.entry));
          else if (p.type === 'reset') self.buffer.push('--- (journal reinitialise) ---');
        });
      }
      return ok;
    },

    disable: function () { this.flush(true); this.enabled = false; },

    // Ajoute un bloc de texte brut (ex : resultat detaille d'un test) puis envoie.
    raw: function (text, sync) {
      this.buffer.push(text);
      return this.flush(sync);
    },

    // Marqueur critique (DEBUT/FIN test, jalon agressif) : envoye tout de suite.
    marker: function (text, sync) {
      this.buffer.push(text);
      return this.flush(sync !== false);  // par defaut synchrone
    },

    // Envoie le tampon accumule. sync=true : bloque jusqu'a persistance disque.
    flush: function (sync) {
      if (!this.enabled || !this.buffer.length) return true;
      var text = this.buffer.join('\n') + '\n';
      this.buffer.length = 0;
      return this._post(text, '', !!sync);
    }
  };

  PSWKT.serverLog = serverLog;

})(typeof window !== 'undefined' ? window : this);
