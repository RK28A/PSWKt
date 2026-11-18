/*
 * PSWKT - FUZZ AGRESSIF (3) : encore plus de vecteurs de stress destructifs
 * destructive:true. Peut figer/planter l'onglet (la PS5 redemarre, aucun dommage
 * materiel/firmware possible depuis un navigateur). Bornes par l'echeance,
 * journalisent leurs paliers (ctx.flush), nettoient leurs ressources si possible.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var G = PSWKT.guard;
  var CAT = 'fuzz_aggressive';
  function mb(b) { return Math.round(b / 1048576 * 100) / 100; }
  function heapMB() { var h = G.readHeap(); return h ? mb(h.usedJSHeapSize) : null; }

  // 1) Tempete de noeuds WebAudio.
  R.register({
    id: 'fuzz.aggr3.audio.nodes', name: '⚠ WebAudio node storm', category: CAT, destructive: true,
    description: 'Creates thousands of audio nodes (and contexts) to saturate the audio engine.',
    run: function (ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return { status: 'skip', detail: 'AudioContext unavailable' };
      var ctxs = [], n = 0;
      try {
        var ac = new AC(); ctxs.push(ac);
        while (true) {
          for (var i = 0; i < 2000; i++) {
            var o = ac.createOscillator(); var g = ac.createGain(); g.gain.value = 0; o.connect(g); n++;
          }
          ctx.tick(); ctx.metric('audio', { noeuds: n, tasMo: heapMB() }); ctx.flush();
          if ((n % 20000) === 0) { try { var ac2 = new AC(); ctxs.push(ac2); ac = ac2; } catch (e) { break; } }
          if (n >= 1000000) break;
        }
      } catch (e) {
        for (var k = 0; k < ctxs.length; k++) { try { ctxs[k].close(); } catch (x) {} }
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' nodes', measurements: { noeuds: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' nodes (' + e.name + ')', measurements: { noeuds: n, error: e.name } };
      }
      for (var j = 0; j < ctxs.length; j++) { try { ctxs[j].close(); } catch (x) {} }
      return { status: 'pass', detail: n + ' audio nodes', measurements: { noeuds: n } };
    }
  });

  // 2) Remplissage de localStorage (quota). Nettoye a la fin.
  R.register({
    id: 'fuzz.aggr3.localstorage.fill', name: '⚠ localStorage saturation', category: CAT, destructive: true,
    description: 'Writes to localStorage up to the quota (QuotaExceededError). Cleans up its keys afterwards.',
    requires: ['platform.localStorage'],
    run: function (ctx) {
      var chunk = new Array(1025).join('X'); // ~1 Ko
      var n = 0, written = 0;
      try {
        while (true) {
          for (var i = 0; i < 100; i++) { global.localStorage.setItem('__pswkt_fill_' + n, chunk); n++; written += chunk.length; }
          ctx.tick(); ctx.metric('localStorage', { cles: n, ko: Math.round(written / 1024) });
          if (n >= 200000) break;
        }
      } catch (e) {
        if (G.isAbort(e)) { cleanup(); return { status: 'aborted', detail: n + ' keys', measurements: { cles: n } }; }
        cleanup();
        return { status: 'pass', detail: 'quota reached at ~' + Math.round(written / 1024) + ' Ko (' + e.name + ')', measurements: { cles: n, ko: Math.round(written / 1024), error: e.name } };
      }
      cleanup();
      return { status: 'pass', detail: n + ' keys written', measurements: { cles: n } };
      function cleanup() { for (var k = 0; k < n; k++) { try { global.localStorage.removeItem('__pswkt_fill_' + k); } catch (x) {} } }
    }
  });

  // 3) Chemin Canvas geant (millions de segments).
  R.register({
    id: 'fuzz.aggr3.canvas.path', name: '⚠ Giant Canvas path', category: CAT, destructive: true,
    description: 'Builds a path of millions of segments and draws it (CPU/GPU + memory).',
    requires: ['canvas.context2d'],
    run: function (ctx) {
      var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024;
      var c = cv.getContext('2d'); var n = 0;
      try {
        c.beginPath();
        for (var i = 0; i < 50000000; i++) { c.lineTo((i * 7) % 1024, (i * 13) % 1024); n++; if ((i & 262143) === 0) { ctx.tick(); if ((i % 2097152) === 0) { c.stroke(); ctx.metric('path', { segments: n, tasMo: heapMB() }); ctx.flush(); } } }
        c.stroke();
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' segments', measurements: { segments: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' segments (' + e.name + ')', measurements: { segments: n, error: e.name } };
      }
      return { status: 'pass', detail: n + ' segments drawn', measurements: { segments: n } };
    }
  });

  // 4) SVG geant (via innerHTML).
  R.register({
    id: 'fuzz.aggr3.svg.huge', name: '⚠ Giant SVG', category: CAT, destructive: true,
    description: 'Injects an SVG with a path of hundreds of thousands of commands into a detached element.',
    requires: ['dom.createElement'],
    run: function (ctx) {
      var out = [];
      try {
        for (var sz = 50000; sz <= 2000000; sz *= 4) {
          ctx.info('SVG path de ' + sz + ' commandes...'); ctx.flush();
          var d = []; for (var i = 0; i < sz; i++) d.push('L' + (i % 1000) + ' ' + (i % 500));
          var host = document.createElement('div');
          host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 ' + d.join(' ') + '"/></svg>';
          out.push({ cmds: sz, tasMo: heapMB() }); ctx.metric('svg', { cmds: sz, tasMo: heapMB() });
          host = null; d = null; ctx.tick();
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: out.length + ' paliers', measurements: { steps: out } };
        return { status: 'pass', detail: 'SVG gave out (' + e.name + ')', measurements: { steps: out, error: e.name } };
      }
      return { status: 'pass', detail: 'SVGs built up to the cap', measurements: { steps: out } };
    }
  });

  // 5) Secousses de mise en page (layout thrashing). Attache au document.
  R.register({
    id: 'fuzz.aggr3.reflow.thrash', name: '⚠ Layout thrashing', category: CAT, destructive: true,
    description: 'Alternates style writes and forced geometry reads to hammer the rendering engine.',
    requires: ['dom.createElement'],
    run: function (ctx) {
      var host = document.createElement('div');
      host.style.position = 'absolute'; host.style.left = '-9999px'; host.style.top = '-9999px';
      var items = [];
      for (var k = 0; k < 500; k++) { var d = document.createElement('div'); d.textContent = 'x'; host.appendChild(d); items.push(d); }
      (document.body || document.documentElement).appendChild(host);
      var n = 0, sink = 0;
      try {
        for (var i = 0; i < 5000000; i++) {
          var it = items[i % items.length];
          it.style.width = (50 + (i % 200)) + 'px';   // ecriture -> invalide la mise en page
          sink += it.offsetWidth + it.offsetHeight;    // lecture -> force un recalcul synchrone
          n++;
          if ((i & 8191) === 0) { ctx.tick(); ctx.metric('reflow', { cycles: n }); }
        }
      } catch (e) {
        try { host.parentNode.removeChild(host); } catch (x) {}
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' cycles', measurements: { cycles: n, sink: sink } };
        throw e;
      }
      try { host.parentNode.removeChild(host); } catch (x) {}
      return { status: 'pass', detail: n + ' reflow cycles', measurements: { cycles: n } };
    }
  });

  // 6) Tempete de getComputedStyle.
  R.register({
    id: 'fuzz.aggr3.computedstyle', name: '⚠ getComputedStyle storm', category: CAT, destructive: true,
    description: 'Calls getComputedStyle and reads properties in a tight loop (style recalcs).',
    requires: ['dom.createElement'],
    run: function (ctx) {
      if (!global.getComputedStyle) return { status: 'skip', detail: 'getComputedStyle unavailable' };
      var host = document.createElement('div');
      for (var k = 0; k < 200; k++) host.appendChild(document.createElement('span'));
      (document.body || document.documentElement).appendChild(host);
      var kids = host.childNodes, n = 0, sink = 0;
      try {
        for (var i = 0; i < 3000000; i++) {
          var el = kids[i % kids.length]; el.style.color = (i & 1) ? 'red' : 'blue';
          var cs = getComputedStyle(el); sink += cs.color.length + cs.width.length; n++;
          if ((i & 8191) === 0) ctx.tick();
        }
      } catch (e) {
        try { host.parentNode.removeChild(host); } catch (x) {}
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' lectures', measurements: { lectures: n } };
        throw e;
      }
      try { host.parentNode.removeChild(host); } catch (x) {}
      return { status: 'pass', detail: n + ' getComputedStyle', measurements: { lectures: n, sink: sink } };
    }
  });

  // 7) Chaine de prototypes tres profonde.
  R.register({
    id: 'fuzz.aggr3.proto.deep', name: '⚠ Deep prototype chain', category: CAT, destructive: true,
    description: 'Builds a very deep prototype chain and resolves a property at the end.',
    run: function (ctx) {
      var base = { found: 42 }, cur = base, depth = 0;
      try {
        while (depth < 5000000) { cur = Object.create(cur); depth++; if ((depth & 16383) === 0) { ctx.tick(); ctx.metric('proto', { depth: depth, tasMo: heapMB() }); } }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'depth ' + depth, measurements: { depth: depth } };
        return { status: 'pass', detail: 'gave out at ' + depth + ' (' + e.name + ')', measurements: { depth: depth, error: e.name } };
      }
      var val; try { val = cur.found; } catch (e2) { val = 'throw:' + e2.name; }
      return { status: 'pass', detail: 'depth ' + depth + ', resolution=' + val, measurements: { depth: depth, resolved: val } };
    }
  });

  // 8) Chaine de Proxy imbriques.
  R.register({
    id: 'fuzz.aggr3.proxy.deep', name: '⚠ Deep nested Proxy', category: CAT, destructive: true,
    description: 'Stacks thousands of Proxies and traverses the chain (each access descends every level).',
    requires: ['objects.Proxy'],
    run: function (ctx) {
      var target = { v: 1 }, depth = 0;
      try {
        while (depth < 200000) { target = new Proxy(target, { get: function (t, k) { return t[k]; } }); depth++; if ((depth & 1023) === 0) { ctx.tick(); if ((depth & 8191) === 0) { void target.v; ctx.metric('proxy', { depth: depth }); } } }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'depth ' + depth, measurements: { depth: depth } };
        return { status: 'pass', detail: 'gave out at ' + depth + ' (' + e.name + ')', measurements: { depth: depth, error: e.name } };
      }
      var val; try { val = target.v; } catch (e2) { val = 'throw:' + e2.name; }
      return { status: 'pass', detail: 'depth ' + depth + ', acces=' + val, measurements: { depth: depth, access: val } };
    }
  });

  // 9) Tri d'un tres grand tableau avec comparateur.
  R.register({
    id: 'fuzz.aggr3.sort.huge', name: '⚠ Giant array sort', category: CAT, destructive: true,
    description: 'Creates a large random array and sorts it with a comparator (CPU + memory).',
    run: function (ctx) {
      var size = 20000000, a = null, n = 0;
      try {
        a = new Array(size);
        for (var i = 0; i < size; i++) { a[i] = (i * 2654435761) % 1000000; n++; if ((i & 1048575) === 0) ctx.tick(); }
        ctx.info('array of ' + n + ' elements built, sorting...'); ctx.flush();
        a.sort(function (x, y) { return x - y; });
        var sorted = a[0] <= a[1] && a[size - 2] <= a[size - 1];
        return { status: 'pass', detail: 'tri de ' + n + ' elements (sorted=' + sorted + ')', measurements: { elements: n, sorted: sorted } };
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' elements', measurements: { elements: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { elements: n, error: e.name } };
      } finally { a = null; }
    }
  });

  // 10) Encodage/decodage de texte geant.
  R.register({
    id: 'fuzz.aggr3.textcodec', name: '⚠ Giant TextEncoder/Decoder', category: CAT, destructive: true,
    description: 'Encodes then decodes ever-larger strings until saturation.',
    requires: ['platform.TextEncoder'],
    run: function (ctx) {
      var enc = new TextEncoder(), dec = new TextDecoder(), last = 0;
      try {
        for (var size = 1048576; size <= 1073741824; size *= 2) {
          ctx.info('text of ' + mb(size) + ' Mo...'); ctx.flush();
          var s = new Array(size + 1).join('e');  // peut lever avant meme d encoder
          var bytes = enc.encode(s); var back = dec.decode(bytes);
          last = back.length; s = null; bytes = null; back = null;
          ctx.metric('textcodec', { mo: mb(size), tasMo: heapMB() }); ctx.tick();
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: '~' + mb(last) + ' Mo', measurements: { chars: last } };
        return { status: 'pass', detail: 'limited to ~' + mb(last) + ' Mo (' + e.name + ')', measurements: { maxChars: last, error: e.name } };
      }
      return { status: 'pass', detail: 'encoding/decoding up to the cap', measurements: { maxChars: last } };
    }
  });

  // 11) JSON.stringify d'une structure geante.
  R.register({
    id: 'fuzz.aggr3.json.huge', name: '⚠ Giant JSON.stringify', category: CAT, destructive: true,
    description: 'Serializes an ever-larger array until memory saturation.',
    run: function (ctx) {
      var last = 0;
      try {
        for (var size = 1000000; size <= 500000000; size *= 2) {
          ctx.info('array of ' + size + ' elements -> JSON...'); ctx.flush();
          var a = new Array(size); for (var i = 0; i < size; i++) { a[i] = i; if ((i & 2097151) === 0) ctx.tick(); }
          var s = JSON.stringify(a); last = s.length; a = null; s = null;
          ctx.metric('json', { elements: size, tasMo: heapMB() });
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: '~' + mb(last) + ' Mo JSON', measurements: { chars: last } };
        return { status: 'pass', detail: 'limited to ~' + mb(last) + ' Mo (' + e.name + ')', measurements: { maxChars: last, error: e.name } };
      }
      return { status: 'pass', detail: 'serialization up to the cap', measurements: { maxChars: last } };
    }
  });

  // 12) Compilation de fonctions en masse (new Function).
  R.register({
    id: 'fuzz.aggr3.function.create', name: '⚠ Mass function compilation', category: CAT, destructive: true,
    description: 'Compiles millions of distinct functions (new Function) to hammer the compiler/JIT.',
    run: function (ctx) {
      var n = 0, sink = 0;
      try {
        for (var i = 0; i < 5000000; i++) { var f = new Function('a', 'return a+' + i + ';'); sink += f(1); n++; if ((i & 8191) === 0) ctx.tick(); }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' functions', measurements: { fonctions: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { fonctions: n, error: e.name } };
      }
      return { status: 'pass', detail: n + ' functions compiled', measurements: { fonctions: n, sink: sink } };
    }
  });

  // 13) Explosion megamorphique (beaucoup de formes d'objets).
  R.register({
    id: 'fuzz.aggr3.megamorphic', name: '⚠ Megamorphic explosion (shapes)', category: CAT, destructive: true,
    description: 'Creates millions of distinct object shapes to saturate inline caches / the JIT.',
    run: function (ctx) {
      var hold = [], n = 0, sink = 0;
      try {
        for (var i = 0; i < 20000000; i++) {
          var o = {}; o['p' + (i % 100000)] = 1; o['q' + i] = 2; // cle unique -> nouvelle forme
          sink += o['q' + i]; hold.push(o); n++;
          if ((i & 65535) === 0) { ctx.tick(); ctx.metric('shapes', { n: n, tasMo: heapMB() }); if (hold.length > 2000000) hold.length = 0; }
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' shapes', measurements: { formes: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { formes: n, error: e.name } };
      } finally { hold = null; }
      return { status: 'pass', detail: n + ' shapes', measurements: { formes: n, sink: sink } };
    }
  });

  // 14) crypto.getRandomValues en masse.
  R.register({
    id: 'fuzz.aggr3.crypto.random', name: '⚠ Mass getRandomValues', category: CAT, destructive: true,
    description: 'Fills random buffers in a tight loop (CPU + entropy).',
    requires: ['platform.crypto'],
    run: function (ctx) {
      if (!global.crypto || !crypto.getRandomValues) return { status: 'skip', detail: 'getRandomValues unavailable' };
      var buf = new Uint8Array(65536), n = 0, bytes = 0;
      try {
        for (var i = 0; i < 2000000; i++) { crypto.getRandomValues(buf); n++; bytes += 65536; if ((i & 1023) === 0) { ctx.tick(); ctx.metric('random', { appels: n, mo: mb(bytes) }); } }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: n + ' calls (' + mb(bytes) + ' Mo)', measurements: { appels: n } };
        return { status: 'pass', detail: 'gave out at ' + n + ' (' + e.name + ')', measurements: { appels: n, error: e.name } };
      }
      return { status: 'pass', detail: n + ' calls, ' + mb(bytes) + ' Mo aleatoires', measurements: { appels: n } };
    }
  });

  // 15) Un seul Blob geant.
  R.register({
    id: 'fuzz.aggr3.blob.huge', name: '⚠ Giant Blob', category: CAT, destructive: true,
    description: 'Builds a single ever-growing Blob until memory saturation.',
    requires: ['platform.Blob'],
    run: function (ctx) {
      var last = 0;
      try {
        for (var size = 16; size <= 2048; size *= 2) {  // Mo
          ctx.info('Blob de ' + size + ' Mo...'); ctx.flush();
          var parts = []; for (var k = 0; k < size; k++) parts.push(new Uint8Array(1048576));
          var blob = new Blob(parts); last = blob.size; parts = null; blob = null;
          ctx.metric('blob', { mo: size, tasMo: heapMB() }); ctx.tick();
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: '~' + mb(last) + ' Mo', measurements: { bytes: last } };
        return { status: 'pass', detail: 'limited to ~' + mb(last) + ' Mo (' + e.name + ')', measurements: { maxBytes: last, error: e.name } };
      }
      return { status: 'pass', detail: 'Blob up to the cap (~' + mb(last) + ' Mo)', measurements: { maxBytes: last } };
    }
  });

})(typeof window !== 'undefined' ? window : this);
