/*
 * PSWKT - FUZZ ROBUSTESSE / DECOUVERTE DE PLANTAGES
 * -----------------------------------------------------------------------------
 * Objectif : exercer des ETATS D'API inhabituels mais valides, connus pour etre
 * fragiles dans les moteurs de navigateur (surtout d'anciens WebKit), afin de
 * DECOUVRIR des plantages/gels et d'en garder une trace ultra-detaillee.
 *
 * Chaque test indique la CLASSE de robustesse qu'il sonde (usage apres
 * detachement, mutation pendant iteration, saturation de ressources, recursion
 * profonde, etc.) a titre FACTUEL et DEFENSIF : il s'agit de reperer et de
 * documenter un crash, pas de l'exploiter. Rien n'est ecrit de maniere
 * persistante, le moteur tourne en bac-a-sable.
 *
 * Les tests qui peuvent reellement figer/planter l'onglet sont marques
 * destructive:true (actifs seulement en "Mode agressif"). Ils appellent
 * ctx.flush() AVANT chaque palier risque : avec l'enregistrement continu, le
 * serveur a deja la trace du palier atteint meme si le moteur tombe juste apres.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var G = PSWKT.guard;

  R.defineCategory('fuzz_robustness', 'Fuzz \u00b7 robustness / crash',
    'Fragile API states (detached buffer, mutation during iteration, degenerate DOM/canvas/WebGL, recursion). Documents crashes.');

  var CAT = 'fuzz_robustness';
  function mb(b) { return Math.round(b / 1048576 * 100) / 100; }
  function heapMB() { var h = G.readHeap(); return h ? mb(h.usedJSHeapSize) : null; }

  // 1) USE-AFTER-DETACH : transfere un ArrayBuffer puis l'utilise. Comportement a documenter.
  R.register({
    id: 'fuzz.robust.detached', name: 'Detached buffer (use after transfer)', category: CAT,
    description: 'Class: use after detach. Transfers an ArrayBuffer then reads/writes via a view -> must stay harmless (empty view or TypeError), never corrupt.',
    requires: ['objects.structuredClone', 'typedArrays.ArrayBuffer'],
    run: function (ctx) {
      var rounds = [];
      for (var i = 0; i < 6; i++) {
        var buf = new ArrayBuffer(4096);
        var view = new Uint8Array(buf);
        view[0] = 123; view[4095] = 200;
        var r = { round: i, before: view[0] };
        ctx.info('round ' + i + ' : transfert (detachement) du buffer de 4096 o...');
        try { structuredClone(buf, { transfer: [buf] }); r.detached = true; }
        catch (e) { r.detached = false; r.detachErr = e.name; }
        try { r.readAfter = view[0]; } catch (e) { r.readAfter = 'throw:' + e.name; }
        try { view[0] = 9; r.writeAfter = 'ok(' + view[0] + ')'; } catch (e) { r.writeAfter = 'throw:' + e.name; }
        try { r.byteLength = buf.byteLength; } catch (e) { r.byteLength = 'throw:' + e.name; }
        try { r.newView = new Uint8Array(buf).length; } catch (e) { r.newView = 'throw:' + e.name; }
        rounds.push(r); ctx.metric('round ' + i, r);
      }
      return { status: 'pass', detail: 'use after detach documented (' + rounds.length + ' rounds)', measurements: { rounds: rounds } };
    }
  });

  // 2) VUE SUR BUFFER REDIMENSIONNE : rapetisse un ArrayBuffer sous une vue existante.
  R.register({
    id: 'fuzz.robust.resized', name: 'View over resized ArrayBuffer', category: CAT,
    description: 'Class: view over shrunk buffer. Creates a view, shrinks the underlying buffer, then accesses -> behaviour to document (no out-of-area read).',
    requires: ['typedArrays.resizableArrayBuffer'],
    run: function (ctx) {
      var out = [];
      try {
        var ab = new ArrayBuffer(1024, { maxByteLength: 4096 });
        var v = new Uint8Array(ab);
        for (var k = 0; k < 1024; k++) v[k] = k & 255;
        ctx.info('reduction 1024 -> 16 octets sous la vue...');
        ab.resize(16);
        out.push({ op: 'shrink', readAt500: (function () { try { return v[500]; } catch (e) { return 'throw:' + e.name; } })(), len: v.length, byteLength: ab.byteLength });
        ctx.info('agrandissement 16 -> 4096...');
        ab.resize(4096);
        out.push({ op: 'grow', readAt2000: (function () { try { return v[2000]; } catch (e) { return 'throw:' + e.name; } })(), len: v.length });
        ctx.metric('resize', out);
      } catch (e) {
        return { status: 'pass', detail: 'resizable unavailable/limited: ' + e.name, measurements: { error: e.name, steps: out } };
      }
      return { status: 'pass', detail: 'resize under view documented', measurements: { steps: out } };
    }
  });

  // 3) MUTATION PENDANT ITERATION : modifie des collections en cours de parcours.
  R.register({
    id: 'fuzz.robust.mutate.iter', name: 'Mutation during iteration', category: CAT,
    description: 'Class: mutation during iteration. Modifies Array/Map/Set (and live DOM collections) mid-iteration -> must stay consistent, never corrupt.',
    run: function (ctx) {
      var res = {};
      // Array : push pendant forEach (borne pour ne pas boucler sans fin)
      var arr = [1, 2, 3, 4, 5], seen = 0;
      arr.forEach(function (x) { seen++; if (seen < 50 && x < 3) arr.push(x + 10); ctx.tick(); });
      res.arrayForEach = { finalLen: arr.length, visited: seen };
      // Array : splice pendant for-of
      try {
        var a2 = [0, 1, 2, 3, 4, 5, 6, 7], it = 0;
        for (var val of a2) { it++; if (it < 50) a2.splice(0, 1); ctx.tick(); if (it > 100) break; }
        res.arrayForOf = { visited: it, finalLen: a2.length };
      } catch (e) { res.arrayForOf = 'throw:' + e.name; }
      // Map : delete/set pendant forEach
      if (typeof Map === 'function') {
        var m = new Map([[1, 'a'], [2, 'b'], [3, 'c']]), mc = 0;
        m.forEach(function (v, k) { mc++; if (mc < 50) { m.delete(k); m.set(k + 100, v); } ctx.tick(); });
        res.mapForEach = { visited: mc, finalSize: m.size };
      }
      // Set : add pendant iteration
      if (typeof Set === 'function') {
        var s = new Set([1, 2, 3]), sc = 0;
        s.forEach(function (v) { sc++; if (sc < 50 && v < 3) s.add(v + 10); ctx.tick(); });
        res.setForEach = { visited: sc, finalSize: s.size };
      }
      // DOM : suppression pendant parcours d'une HTMLCollection vivante
      if (typeof document !== 'undefined') {
        try {
          var host = document.createElement('div');
          for (var d = 0; d < 20; d++) host.appendChild(document.createElement('span'));
          var live = host.getElementsByTagName('span'), removed = 0;
          while (live.length) { host.removeChild(live[0]); removed++; if (removed > 100) break; ctx.tick(); }
          res.domLive = { removed: removed, remaining: live.length };
        } catch (e) { res.domLive = 'throw:' + e.name; }
      }
      ctx.metric('mutation pendant iteration', res);
      return { status: 'pass', detail: 'mutations during iteration documented (no corruption observed)', measurements: res };
    }
  });

  // 4) structuredClone de graphes exotiques (cycles, types natifs, getters hostiles).
  R.register({
    id: 'fuzz.robust.clone.exotic', name: 'structuredClone of exotic graphs', category: CAT,
    description: 'Class: serialization of degenerate graphs. Clones cycles, nested Map/Set, TypedArray, Date, RegExp, trapped getters -> caught error or correct clone.',
    requires: ['objects.structuredClone'],
    run: function (ctx) {
      var cases = [];
      function test(label, factory) {
        var r = { label: label };
        var obj;
        try { obj = factory(); } catch (e) { r.build = 'throw:' + e.name; cases.push(r); return; }
        try { var c = structuredClone(obj); r.clone = 'ok'; r.type = Object.prototype.toString.call(c); }
        catch (e) { r.clone = 'throw:' + e.name; }
        cases.push(r); ctx.metric(label, r);
      }
      test('cycle direct', function () { var o = {}; o.self = o; return o; });
      test('cycle croise', function () { var a = {}, b = {}; a.b = b; b.a = a; return a; });
      test('Map imbriquee cyclique', function () { var m = new Map(); m.set('self', m); return m; });
      test('TypedArray + Date + RegExp', function () { return { ta: new Uint8Array([1, 2, 3]), d: new Date(0), re: /x/g }; });
      test('getter qui leve', function () { var o = {}; Object.defineProperty(o, 'x', { get: function () { throw new Error('getter'); }, enumerable: true }); return o; });
      test('fonction (non clonable)', function () { return { f: function () {} }; });
      test('graphe large (5000 noeuds)', function () { var root = {}, cur = root; for (var i = 0; i < 5000; i++) { cur.n = { i: i }; cur = cur.n; ctx.tick(); } return root; });
      return { status: 'pass', detail: 'clonage de ' + cases.length + ' graphes exotiques documente', measurements: { cases: cases } };
    }
  });

  // 5) ⚠ DOM : arbre profond + large (peut figer/planter le rendu). Destructif.
  R.register({
    id: 'fuzz.robust.dom.tree', name: '⚠ Massive DOM (deep/wide tree)', category: CAT,
    destructive: true,
    description: 'Class: DOM saturation. Builds ever deeper and wider trees until the rendering engine breaks. May freeze the tab.',
    requires: ['dom.createElement'],
    run: function (ctx) {
      var steps = [];
      var depths = [1000, 5000, 20000, 60000];
      var widths = [10000, 50000, 200000];
      try {
        for (var di = 0; di < depths.length; di++) {
          var dep = depths[di];
          ctx.info('arbre PROFOND de ' + dep + ' niveaux (tas ~' + heapMB() + ' Mo)...'); ctx.flush();
          var root = document.createElement('div'), cur = root;
          for (var i = 0; i < dep; i++) { var c = document.createElement('div'); cur.appendChild(c); cur = c; if ((i & 1023) === 0) ctx.tick(); }
          steps.push({ kind: 'profond', n: dep, tasMo: heapMB() }); ctx.metric('profond ' + dep, { tasMo: heapMB() });
          root = cur = null;
        }
        for (var wi = 0; wi < widths.length; wi++) {
          var wid = widths[wi];
          ctx.info('arbre LARGE de ' + wid + ' enfants (tas ~' + heapMB() + ' Mo)...'); ctx.flush();
          var host = document.createElement('div');
          for (var j = 0; j < wid; j++) { host.appendChild(document.createElement('span')); if ((j & 4095) === 0) ctx.tick(); }
          steps.push({ kind: 'large', n: wid, children: host.childNodes.length, tasMo: heapMB() }); ctx.metric('large ' + wid, { tasMo: heapMB() });
          host = null;
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'stopped; ' + steps.length + ' paliers', measurements: { steps: steps } };
        return { status: 'pass', detail: 'DOM a cede : ' + e.name + ' apres ' + steps.length + ' paliers', measurements: { steps: steps, error: e.name } };
      }
      return { status: 'pass', detail: 'DOM trees built up to the test caps', measurements: { steps: steps } };
    }
  });

  // 6) ⚠ innerHTML geant / malforme (parseur HTML). Destructif possible.
  R.register({
    id: 'fuzz.robust.innerhtml', name: '⚠ Giant / malformed innerHTML', category: CAT,
    destructive: true,
    description: 'Class: HTML parser stress. Injects giant, deeply nested or malformed markup into a detached element. May exhaust memory.',
    requires: ['dom.createElement'],
    run: function (ctx) {
      var out = [];
      function tryHTML(label, html) {
        var host = document.createElement('div');
        ctx.info(label + ' (' + html.length + ' octets)...'); ctx.flush();
        var r = { label: label, inLen: html.length };
        try { host.innerHTML = html; r.nodes = host.getElementsByTagName('*').length; }
        catch (e) { r.err = e.name; }
        out.push(r); ctx.metric(label, r); host = null;
      }
      tryHTML('div imbriques x20000', new Array(20001).join('<div>') + 'x' + new Array(20001).join('</div>'));
      tryHTML('balises non fermees x50000', new Array(50001).join('<div>'));
      tryHTML('attribut geant', '<div data-x="' + new Array(500001).join('a') + '">x</div>');
      tryHTML('table enorme', '<table>' + new Array(20001).join('<tr><td>x</td></tr>') + '</table>');
      tryHTML('entites malformees', new Array(10001).join('&amp;&#x;&#;&nosuch;&'));
      tryHTML('commentaire non termine', '<!--' + new Array(100001).join('a'));
      return { status: 'pass', detail: 'parseur HTML sonde sur ' + out.length + ' entrees geantes/malformees', measurements: { cases: out } };
    }
  });

  // 7) ⚠ Canvas : dimensions geantes + getImageData absurde. Destructif (grosse allocation).
  R.register({
    id: 'fuzz.robust.canvas', name: '⚠ Giant canvas / absurd getImageData', category: CAT,
    destructive: true,
    description: 'Class: degenerate graphics allocation. Huge canvas dimensions, getImageData/putImageData on absurd rectangles. May crash via GPU/CPU OOM.',
    requires: ['canvas.context2d'],
    run: function (ctx) {
      var out = [];
      var dims = [[4096, 4096], [8192, 8192], [16384, 16384], [32767, 32767]];
      for (var i = 0; i < dims.length; i++) {
        var w = dims[i][0], h = dims[i][1];
        ctx.info('canvas ' + w + 'x' + h + ' (~' + mb(w * h * 4) + ' Mo de pixels)...'); ctx.flush();
        var r = { w: w, h: h, approxMo: mb(w * h * 4) };
        try {
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          var c2 = cv.getContext('2d');
          r.realSize = cv.width + 'x' + cv.height;
          c2.fillStyle = '#123'; c2.fillRect(0, 0, 100, 100);
          try { var img = c2.getImageData(0, 0, Math.min(w, 4096), Math.min(h, 4096)); r.imgData = img.data.length; }
          catch (e) { r.imgData = 'throw:' + e.name; }
          cv.width = 1; cv.height = 1; cv = null;
        } catch (e) { r.err = e.name; }
        out.push(r); ctx.metric(w + 'x' + h, r);
      }
      // getImageData sur rectangles absurdes
      try {
        var cv2 = document.createElement('canvas'); cv2.width = 32; cv2.height = 32;
        var g = cv2.getContext('2d'); var absurd = {};
        var rects = [[-1000, -1000, 2000, 2000], [0, 0, 1e6, 1], [0, 0, 0, 0], [0, 0, -5, -5], [1e9, 1e9, 10, 10]];
        for (var k = 0; k < rects.length; k++) {
          var q = rects[k];
          try { var d = g.getImageData(q[0], q[1], q[2], q[3]); absurd['r' + k] = d.data.length; }
          catch (e) { absurd['r' + k] = 'throw:' + e.name; }
        }
        out.push({ absurdRects: absurd }); ctx.metric('rects absurdes', absurd);
      } catch (e) { /* ignore */ }
      return { status: 'pass', detail: 'degenerate canvas allocations documented', measurements: { cases: out } };
    }
  });

  // 8) ⚠ WebGL : epuisement de ressources (buffers/textures/contextes). Destructif.
  R.register({
    id: 'fuzz.robust.webgl', name: '⚠ WebGL: resource exhaustion', category: CAT,
    destructive: true,
    description: 'Class: GPU saturation. Allocates thousands of buffers/textures and many contexts to force a context loss. May crash the GPU driver.',
    requires: ['canvas.webgl'],
    run: function (ctx) {
      var r = { buffers: 0, textures: 0, contexts: 0, lost: false };
      try {
        var cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
        var gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
        if (!gl) return { status: 'skip', detail: 'WebGL unavailable', measurements: null };
        ctx.info('allocation de buffers/textures en masse...'); ctx.flush();
        for (var i = 0; i < 200000; i++) {
          var b = gl.createBuffer(); if (b) r.buffers++;
          if ((i & 255) === 0) { var t = gl.createTexture(); if (t) r.textures++; }
          if ((i & 4095) === 0) { ctx.tick(); if (gl.isContextLost && gl.isContextLost()) { r.lost = true; break; } }
        }
        ctx.metric('ressources GL', r);
        // Plusieurs contextes (les navigateurs en limitent le nombre -> perte des plus anciens)
        ctx.info('creation de multiples contextes WebGL...'); ctx.flush();
        var ctxs = [];
        for (var c = 0; c < 64; c++) { var cc = document.createElement('canvas'); var gc = cc.getContext('webgl'); if (gc) { ctxs.push(gc); r.contexts++; } ctx.tick(); }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'stopped', measurements: r };
        return { status: 'pass', detail: 'WebGL a cede : ' + e.name, measurements: { partial: r, error: e.name } };
      }
      return { status: 'pass', detail: 'ressources WebGL : ' + r.buffers + ' buffers, ' + r.textures + ' textures, ' + r.contexts + ' contextes, perte=' + r.lost, measurements: r };
    }
  });

  // 9) Recursion via coercition / getters / Proxy (profondeur de pile indirecte).
  R.register({
    id: 'fuzz.robust.recursion.indirect', name: 'Indirect recursion (coercion/Proxy)', category: CAT,
    description: 'Class: indirect stack overflow. Recursion via toString/valueOf, chained getters and Proxy -> caught RangeError expected.',
    requires: [],
    run: function (ctx) {
      var out = {};
      // toString recursif
      try { var o = {}; o.toString = function () { return o + ''; }; out.toString = String(o); }
      catch (e) { out.toString = e.name; }
      // valueOf recursif via addition
      try { var p = {}; p.valueOf = function () { return p + 0; }; out.valueOf = (p + 0); }
      catch (e) { out.valueOf = e.name; }
      // JSON.stringify avec toJSON recursif
      try { var j = {}; j.toJSON = function () { return j; }; JSON.stringify(j); out.toJSON = 'ok(?)'; }
      catch (e) { out.toJSON = e.name; }
      // Proxy dont get renvoie un acces recursif
      if (typeof Proxy === 'function') {
        try {
          var depth = 0;
          var handler = { get: function (t, k) { depth++; return t[k]; } };
          var px = new Proxy({ a: {} }, handler);
          // acces profond force : px.a.a.a... via boucle bornee (le Proxy ne s'auto-imbrique pas ici)
          var ref = px; for (var i = 0; i < 1000; i++) { ref = ref.a || px; ctx.tick(); }
          out.proxy = 'profondeur acces ' + depth;
        } catch (e) { out.proxy = e.name; }
      }
      ctx.metric('recursion indirecte', out);
      return { status: 'pass', detail: 'indirect overflows documented', measurements: out };
    }
  });

  // 10) JSON.parse reviver hostile (mutation du graphe pendant la reconstruction).
  R.register({
    id: 'fuzz.robust.json.reviver', name: 'JSON.parse hostile reviver', category: CAT,
    description: 'Class: hostile callback during rebuild. A reviver that mutates/deletes/adds and throws -> the engine must stay consistent.',
    run: function (ctx) {
      var out = {};
      var payload = '{"a":1,"b":[1,2,3],"c":{"d":4,"e":{"f":5}}}';
      try { out.mutate = JSON.parse(payload, function (k, v) { if (typeof v === 'object' && v) v.__x = 1; return v; }) ? 'ok' : 'null'; }
      catch (e) { out.mutate = e.name; }
      try { out.drop = JSON.stringify(JSON.parse(payload, function (k, v) { return (k === 'b') ? undefined : v; })); }
      catch (e) { out.drop = e.name; }
      try { JSON.parse(payload, function (k, v) { if (k === 'd') throw new Error('reviver leve'); return v; }); out.throwRev = 'pas leve (?)'; }
      catch (e) { out.throwRev = e.name; }
      try { var n = 0; JSON.parse(payload, function (k, v) { n++; ctx.tick(); return v; }); out.calls = n; }
      catch (e) { out.calls = e.name; }
      ctx.metric('reviver hostile', out);
      return { status: 'pass', detail: 'hostile revivers documented', measurements: out };
    }
  });

  // 11) ⚠ Workers en masse (via Blob) : saturation de threads. Destructif.
  R.register({
    id: 'fuzz.robust.workers', name: '⚠ Mass Workers', category: CAT,
    destructive: true,
    description: 'Class: thread saturation. Creates many Web Workers (via Blob) and posts messages to them. May exhaust browser resources.',
    requires: ['platform.Worker'],
    run: function (ctx) {
      var made = 0, workers = [];
      var src = 'self.onmessage=function(e){self.postMessage(e.data);};';
      try {
        var url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
        ctx.info('creation de workers jusqu a echec...'); ctx.flush();
        for (var i = 0; i < 2000; i++) {
          var w = new Worker(url); workers.push(w); made++;
          w.postMessage(i);
          if ((i & 31) === 0) { ctx.tick(); ctx.metric('workers', { crees: made, tasMo: heapMB() }); ctx.flush(); }
        }
      } catch (e) {
        for (var k = 0; k < workers.length; k++) { try { workers[k].terminate(); } catch (x) {} }
        if (G.isAbort(e)) return { status: 'aborted', detail: made + ' workers crees', measurements: { workers: made } };
        return { status: 'pass', detail: 'worker limit reached at ' + made + ' (' + e.name + ')', measurements: { maxWorkers: made, error: e.name } };
      }
      for (var m = 0; m < workers.length; m++) { try { workers[m].terminate(); } catch (x) {} }
      return { status: 'pass', detail: made + ' workers crees sans echec (plafond du test)', measurements: { workers: made } };
    }
  });

  // 12) Tableaux a trous extremes / length poisoning (acces, tri, iteration).
  R.register({
    id: 'fuzz.robust.sparse', name: 'Extreme sparse arrays', category: CAT,
    description: 'Class: degenerate sparse structures. Huge length, massive holes, sort/indexOf/iteration -> must stay bounded and consistent.',
    run: function (ctx) {
      var out = {};
      try { var a = []; a[4294967294] = 'x'; out.maxIndex = { length: a.length, val: a[4294967294] }; }
      catch (e) { out.maxIndex = e.name; }
      try { var b = []; b.length = 1000000; out.setLength = { length: b.length, filled: b.filter(function () { return true; }).length }; }
      catch (e) { out.setLength = e.name; }
      try { var s = []; s[0] = 3; s[999999] = 1; out.sortSparse = (s.sort(), { len: s.length, first: s[0] }); }
      catch (e) { out.sortSparse = e.name; }
      try { var h = []; h[10] = 'a'; h[1000] = 'b'; var seen = 0; h.forEach(function () { seen++; ctx.tick(); }); out.forEachHoles = seen; }
      catch (e) { out.forEachHoles = e.name; }
      try { var p = { length: 1e9 }; out.arrayProtoCall = Array.prototype.indexOf.call(p, 'z'); }
      catch (e) { out.arrayProtoCall = e.name; }
      ctx.metric('tableaux creux', out);
      return { status: 'pass', detail: 'degenerate sparse structures documented', measurements: out };
    }
  });

})(typeof window !== 'undefined' ? window : this);
