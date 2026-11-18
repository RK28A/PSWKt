/*
 * PSWKT - FUZZ AGRESSIF (2) : plus de stress destructif
 * Memes regles que fuzz_aggressive.js : destructive:true, peut figer/planter
 * (la PS5 redemarre, aucun dommage), bornes par l'echeance, journalise ses
 * paliers (ctx.flush) avant de pousser plus loin.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var G = PSWKT.guard;
  var CAT = 'fuzz_aggressive';
  function mb(b) { return Math.round(b / 1048576 * 100) / 100; }
  function heapMB() { var h = G.readHeap(); return h ? mb(h.usedJSHeapSize) : null; }

  // 1) Deluge de promesses / microtaches.
  R.register({
    id: 'fuzz.aggr2.promise.flood', name: '⚠ Promise flood', category: CAT, destructive: true,
    description: 'Creates millions of resolved promises and chains microtasks until the deadline or OOM.',
    requires: ['timing.Promise'],
    run: function (ctx) {
      var made = 0; var target = 20000000;
      return new Promise(function (resolve) {
        function burst() {
          var t0 = PSWKT.now();
          try {
            while (PSWKT.now() - t0 < 50) {
              for (var i = 0; i < 10000; i++) { Promise.resolve(i).then(function () {}); made++; }
              ctx.tick();
            }
          } catch (e) {
            if (G.isAbort(e)) return resolve({ status: 'aborted', detail: made + ' promises', measurements: { promesses: made, tasMo: heapMB() } });
            return resolve({ status: 'pass', detail: 'gave out at ' + made + ' (' + e.name + ')', measurements: { promesses: made, error: e.name } });
          }
          ctx.metric('promesses', { crees: made, tasMo: heapMB() });
          if (made < target) global.setTimeout(burst, 0);
          else resolve({ status: 'pass', detail: made + ' promises', measurements: { promesses: made } });
        }
        burst();
      });
    }
  });

  // 2) Croissance Map/Set jusqu'a saturation.
  R.register({
    id: 'fuzz.aggr2.map.growth', name: '⚠ Map/Set growth', category: CAT, destructive: true,
    description: 'Inserts entries into a Map and a Set until memory saturation.',
    requires: ['objects.Map'],
    run: function (ctx) {
      var m = new Map(), s = new Set(), n = 0;
      try {
        while (true) {
          for (var i = 0; i < 100000; i++) { m.set(n, n); s.add('k' + n); n++; }
          ctx.tick(); ctx.metric('size', { entrees: n, tasMo: heapMB() }); ctx.flush();
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' entries', measurements: { entrees: n } };
        return { status: 'pass', detail: 'sature a ' + n + ' entries (' + e.name + ')', measurements: { maxEntrees: n, error: e.name } };
      } finally { m = null; s = null; }
    }
  });

  // 3) Deluge de timers.
  R.register({
    id: 'fuzz.aggr2.timers', name: '⚠ Timer flood', category: CAT, destructive: true,
    description: 'Schedules a very large number of setTimeout to saturate the timer queue.',
    run: function (ctx) {
      var n = 0, ids = [];
      try {
        for (var i = 0; i < 2000000; i++) { ids.push(global.setTimeout(function () {}, 100000)); n++; if ((i & 8191) === 0) { ctx.tick(); ctx.metric('timers', { n: n, tasMo: heapMB() }); } }
      } catch (e) {
        for (var k = 0; k < ids.length; k++) { try { global.clearTimeout(ids[k]); } catch (x) {} }
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' timers', measurements: { timers: n } };
        return { status: 'pass', detail: 'limited to ' + n + ' timers (' + e.name + ')', measurements: { maxTimers: n, error: e.name } };
      }
      for (var j = 0; j < ids.length; j++) { try { global.clearTimeout(ids[j]); } catch (x) {} }
      return { status: 'pass', detail: n + ' timers scheduled and cancelled', measurements: { timers: n } };
    }
  });

  // 4) Deluge d'URL d'objets (Blob).
  R.register({
    id: 'fuzz.aggr2.bloburl', name: '⚠ Object URL flood', category: CAT, destructive: true,
    description: 'Creates very many Blob + URL.createObjectURL (deliberate bounded memory leak).',
    requires: ['platform.Blob'],
    run: function (ctx) {
      if (!global.URL || !URL.createObjectURL) return { status: 'skip', detail: 'createObjectURL unavailable' };
      var n = 0, urls = [];
      try {
        while (true) {
          for (var i = 0; i < 1000; i++) { urls.push(URL.createObjectURL(new Blob(['x'.repeat(1024)]))); n++; }
          ctx.tick(); ctx.metric('urls', { n: n, tasMo: heapMB() }); ctx.flush();
          if (n >= 500000) break;
        }
      } catch (e) {
        if (!G.isAbort(e)) { for (var k = 0; k < urls.length; k++) { try { URL.revokeObjectURL(urls[k]); } catch (x) {} } return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { urls: n, error: e.name } }; }
        return { status: 'aborted', detail: n + ' urls', measurements: { urls: n } };
      }
      for (var j = 0; j < urls.length; j++) { try { URL.revokeObjectURL(urls[j]); } catch (x) {} }
      return { status: 'pass', detail: n + ' object URLs', measurements: { urls: n } };
    }
  });

  // 5) Tempete d'evenements synthetiques.
  R.register({
    id: 'fuzz.aggr2.events', name: '⚠ Event storm', category: CAT, destructive: true,
    description: 'Creates a target and dispatches millions of synthetic events.',
    requires: ['dom.addEventListener'],
    run: function (ctx) {
      var target = document.createElement('div'); var count = 0; var n = 0;
      target.addEventListener('x', function () { count++; });
      try {
        for (var i = 0; i < 5000000; i++) { target.dispatchEvent(new Event('x')); n++; if ((i & 16383) === 0) { ctx.tick(); ctx.metric('events', { dispatch: n, recus: count }); } }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' events', measurements: { dispatch: n, recus: count } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { dispatch: n, error: e.name } };
      }
      return { status: 'pass', detail: n + ' events dispatched, ' + count + ' received', measurements: { dispatch: n, recus: count } };
    }
  });

  // 6) toDataURL repete sur canvas.
  R.register({
    id: 'fuzz.aggr2.todataurl', name: '⚠ Repeated toDataURL', category: CAT, destructive: true,
    description: 'Serializes a canvas to dataURL in a tight loop (CPU + memory).',
    requires: ['canvas.context2d'],
    run: function (ctx) {
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
      var c = cv.getContext('2d'); c.fillStyle = '#4af'; c.fillRect(0, 0, 512, 512);
      var n = 0, bytes = 0;
      try {
        for (var i = 0; i < 100000; i++) { var d = cv.toDataURL('image/png'); bytes += d.length; n++; if ((i & 63) === 0) { ctx.tick(); ctx.metric('dataurl', { n: n, tasMo: heapMB() }); } }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' serializations', measurements: { n: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { n: n, error: e.name } };
      }
      return { status: 'pass', detail: n + ' dataURL (' + mb(bytes * 2) + ' Mo cumules)', measurements: { n: n } };
    }
  });

  // 7) Tempete throw/catch (piles).
  R.register({
    id: 'fuzz.aggr2.throwcatch', name: '⚠ throw/catch storm', category: CAT, destructive: true,
    description: 'Throws and catches millions of exceptions (with stack capture) in a tight loop.',
    run: function (ctx) {
      var n = 0, stackLen = 0;
      try {
        for (var i = 0; i < 10000000; i++) {
          try { throw new Error('e' + i); } catch (e) { stackLen = (e.stack || '').length; n++; }
          if ((i & 32767) === 0) ctx.tick();
        }
      } catch (e2) {
        if (G.isAbort(e2)) return { status: 'aborted', detail: n + ' exceptions', measurements: { exceptions: n, stackLen: stackLen } };
        throw e2;
      }
      return { status: 'pass', detail: n + ' exceptions thrown/caught', measurements: { exceptions: n, stackLen: stackLen } };
    }
  });

  // 8) Concatenation lineaire geante.
  R.register({
    id: 'fuzz.aggr2.concat', name: '⚠ Giant concatenation (linear)', category: CAT, destructive: true,
    description: 'Grows a string by small repeated appends until the memory limit.',
    run: function (ctx) {
      var s = '', n = 0, chunk = 'x'.repeat(4096);
      try {
        while (true) { s += chunk; n++; if ((n & 255) === 0) { ctx.tick(); ctx.metric('string', { ko: Math.round(s.length / 1024), tasMo: heapMB() }); } }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: Math.round(s.length / 1048576) + ' Mo', measurements: { chars: s.length } };
        return { status: 'pass', detail: 'limited to ~' + mb(s.length * 2) + ' Mo (' + e.name + ')', measurements: { maxChars: s.length, error: e.name } };
      } finally { s = null; }
    }
  });

  // 9) Nids de tableaux (profondeur par imbrication reelle).
  R.register({
    id: 'fuzz.aggr2.nested.arrays', name: '⚠ Giant nested arrays', category: CAT, destructive: true,
    description: 'Builds a deeply nested array and walks it until saturation/stack.',
    run: function (ctx) {
      var root = [], cur = root, depth = 0;
      try {
        while (depth < 10000000) { var n = []; cur.push(n); cur = n; depth++; if ((depth & 4095) === 0) { ctx.tick(); ctx.metric('depth', { depth: depth, tasMo: heapMB() }); } }
        return { status: 'pass', detail: 'depth ' + depth + ' (plafond)', measurements: { depth: depth } };
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'depth ' + depth, measurements: { depth: depth } };
        return { status: 'pass', detail: 'gave out at ' + depth + ' levels (' + e.name + ')', measurements: { maxDepth: depth, error: e.name } };
      } finally { root = null; }
    }
  });

  // 10) Compilation RegExp en masse.
  R.register({
    id: 'fuzz.aggr2.regex.compile', name: '⚠ Mass RegExp compilation', category: CAT, destructive: true,
    description: 'Compiles millions of distinct RegExps to hammer the regex compiler.',
    run: function (ctx) {
      var n = 0;
      try {
        for (var i = 0; i < 5000000; i++) { void new RegExp('a' + (i % 97) + 'b{' + (i % 7 + 1) + '}c'); n++; if ((i & 16383) === 0) ctx.tick(); }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' regex', measurements: { regex: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { regex: n, error: e.name } };
      }
      return { status: 'pass', detail: n + ' RegExps compiled', measurements: { regex: n } };
    }
  });

  // 11) WeakMap + WeakRef en masse.
  R.register({
    id: 'fuzz.aggr2.weak', name: '⚠ Mass WeakMap/WeakRef', category: CAT, destructive: true,
    description: 'Creates very many objects referenced by WeakMap/WeakRef to stress the GC.',
    requires: ['objects.WeakMap'],
    run: function (ctx) {
      var wm = new WeakMap(), hold = [], n = 0;
      try {
        while (true) {
          for (var i = 0; i < 50000; i++) { var o = {}; wm.set(o, i); if (typeof WeakRef === 'function') { void new WeakRef(o); } hold.push(o); n++; }
          ctx.tick(); ctx.metric('weak', { n: n, tasMo: heapMB() }); ctx.flush();
          if (hold.length > 3000000) hold.length = 0; // laisse le GC respirer
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' objects', measurements: { objets: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { objets: n, error: e.name } };
      } finally { hold = null; }
    }
  });

  // 12) Deluge de nombres (CPU pur).
  R.register({
    id: 'fuzz.aggr2.cpu.math', name: '⚠ Intensive computation (CPU)', category: CAT, destructive: true,
    description: 'Very long floating-point loop to saturate the CPU (tests responsiveness/deadline).',
    run: function (ctx) {
      var acc = 0, n = 0;
      try {
        for (var i = 1; i < 2000000000; i++) { acc += Math.sqrt(i) * Math.sin(i) / Math.log(i + 1); n++; if ((i & 1048575) === 0) ctx.tick(); }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' iterations', measurements: { iterations: n, acc: acc } };
        throw e;
      }
      return { status: 'pass', detail: n + ' iterations', measurements: { iterations: n, acc: acc } };
    }
  });

})(typeof window !== 'undefined' ? window : this);
