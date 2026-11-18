/*
 * PSWKT - FUZZ AGRESSIF (tests DESTRUCTIFS)
 * -----------------------------------------------------------------------------
 * Contrairement aux autres categories, ces tests ne cherchent PAS a rester doux :
 * ils poussent deliberement les API jusqu'au POINT DE RUPTURE (saturation memoire,
 * debordement de pile, backtracking regex catastrophique, chaines/tableaux geants).
 * Ils PEUVENT figer ou faire planter l'onglet / le navigateur. C'est le but : sur
 * la PS5, on observe si le navigateur tient, rame, se recharge tout seul ou plante.
 *
 * SANS DANGER POUR LA CONSOLE : le navigateur PS5 est bac-a-sable ; aucun code JS
 * ne peut abimer le materiel ni le firmware. Au pire l'onglet meurt et la PS5 se
 * redemarre normalement. Rien de persistant n'est ecrit.
 *
 * Ils sont marques destructive:true -> ne s'executent QUE si le "Mode agressif"
 * est actif (coche par defaut). Le harnais leur accorde une echeance large et
 * leve les plafonds memoire/iterations. Chaque test journalise sa progression et
 * l'etat du tas AVANT de pousser plus loin, pour qu'un log sauvegarde montre
 * jusqu ou le moteur a tenu meme s'il plante juste apres.
 *
 * Convention de statut ici :
 *   pass    = le moteur a atteint SA limite proprement (ex : RangeError) -> on la rapporte ;
 *   aborted = Stop / echeance filet -> progression partielle rapportee ;
 *   (un plantage reel ne renvoie rien : c'est l'observation, a annoter a la main).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var G = PSWKT.guard;

  R.defineCategory('fuzz_aggressive', 'Fuzz \u00b7 AGGRESSIVE (destructive)',
    'Pushes APIs to the breaking point: memory, stack, regex, giant strings/arrays. May freeze or crash the browser (recoverable; worst case the console restarts).');

  var CAT = 'fuzz_aggressive';

  function mb(bytes) { return Math.round(bytes / 1048576 * 100) / 100; }
  function heapMB() { var h = G.readHeap(); return h ? mb(h.usedJSHeapSize) : null; }

  // 1) BOMBE MEMOIRE : alloue et RETIENT des blocs jusqu'a l'echec d'allocation.
  R.register({
    id: 'fuzz.aggr.mem.bomb', name: '⚠ Memory bomb (retained allocation)', category: CAT,
    destructive: true,
    description: 'Allocates 16 MB ArrayBuffers and KEEPS them until failure (or OOM crash). Reports the total reached.',
    requires: ['typedArrays.ArrayBuffer'],
    run: function (ctx) {
      var kept = [];            // on retient tout -> le GC ne peut rien liberer
      var block = 16 * 1024 * 1024;
      var total = 0, blocks = 0;
      ctx.info('start, heap ~' + heapMB() + ' MB ; allocating in 16 MB blocks and retaining them...');
      try {
        while (true) {
          ctx.tick(); // laisse agir le bouton Stop / l echeance filet
          var buf = new ArrayBuffer(block);
          var view = new Uint8Array(buf);
          // touche quelques pages pour forcer l engagement memoire reel
          for (var p = 0; p < view.length; p += 65536) view[p] = 0xA5;
          kept.push(buf);
          blocks++; total += block;
          if ((blocks % 8) === 0) ctx.metric('progression', { blocsRetenus: blocks, totalMo: mb(total), tasMo: heapMB() });
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'stopped at ' + mb(total) + ' Mo (' + blocks + ' blocks)', measurements: { totalMo: mb(total), blocks: blocks } };
        ctx.info('Allocation FAILED at ' + mb(total) + ' Mo : ' + e.name + ' (' + e.message + ')');
        return { status: 'pass', detail: 'memory limit reached: ' + mb(total) + ' MB retained before ' + e.name,
                 measurements: { ceilingMo: mb(total), blocks: blocks, error: e.name } };
      } finally { kept.length = 0; } // relache (si on y arrive encore)
    }
  });

  // 2) CHAINE GEANTE : double une chaine jusqu'a la longueur maximale du moteur.
  R.register({
    id: 'fuzz.aggr.string.double', name: '⚠ Giant string (doubling)', category: CAT,
    destructive: true,
    description: 'Doubles a string (s += s) until RangeError (max length) or memory crash. Reports the max length.',
    run: function (ctx) {
      var s = 'A', steps = 0, last = 1;
      try {
        while (true) {
          ctx.tick();
          last = s.length;
          s = s + s;             // 1,2,4,... jusqu a la limite dure
          steps++;
          if ((steps % 4) === 0) ctx.metric('length', { chars: s.length, approxMo: mb(s.length * 2), tasMo: heapMB() });
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'stopped at ' + last + ' chars', measurements: { chars: last } };
        ctx.info('string limit: ' + e.name + ' apres ' + last + ' chars (~' + mb(last * 2) + ' Mo)');
        return { status: 'pass', detail: 'max supported length ~' + last + ' chars (' + e.name + ')',
                 measurements: { maxChars: last, maxApproxMo: mb(last * 2), error: e.name } };
      } finally { s = null; }
    }
  });

  // 3) DEBORDEMENT DE PILE : recursion directe jusqu'a RangeError. Rapporte la profondeur.
  R.register({
    id: 'fuzz.aggr.recursion', name: '⚠ Stack overflow (recursion)', category: CAT,
    destructive: true,
    description: 'Unbounded recursion until stack overflow. Reports the maximum depth reached.',
    run: function (ctx) {
      var depth = 0;
      function rec() { depth++; rec(); return depth; } // pas de condition d arret
      try {
        rec();
        return { status: 'pass', detail: 'no limit reached (unexpected)', measurements: { depth: depth } };
      } catch (e) {
        // RangeError 'Maximum call stack size exceeded' attendu, rattrape proprement.
        return { status: 'pass', detail: 'stack overflowed at a depth of ' + depth + ' (' + e.name + ')',
                 measurements: { maxDepth: depth, error: e.name } };
      }
    }
  });

  // 4) IMBRICATION JSON : profondeur croissante jusqu'a l'echec de stringify/parse.
  R.register({
    id: 'fuzz.aggr.json.deep', name: '⚠ Nested JSON to overflow', category: CAT,
    destructive: true,
    description: 'Nests an array ever deeper until JSON.stringify/parse throws (stack). Reports the depth.',
    run: function (ctx) {
      var lastOk = 0;
      try {
        for (var depth = 1000; depth < 20000000; depth += 1000) {
          ctx.tick();
          var a = [];
          var cur = a;
          for (var i = 0; i < depth; i++) { var n = []; cur.push(n); cur = n; }
          var s = JSON.stringify(a);   // peut lever RangeError
          JSON.parse(s);               // idem
          lastOk = depth;
          if ((depth % 5000) === 0) ctx.metric('depth OK', { depth: depth, chars: s.length, tasMo: heapMB() });
        }
        return { status: 'pass', detail: 'no overflow up to 20M (test cap)', measurements: { lastOk: lastOk } };
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'stopped; last depth OK ' + lastOk, measurements: { lastOk: lastOk } };
        return { status: 'pass', detail: 'JSON gave out beyond ~' + lastOk + ' levels (' + e.name + ')',
                 measurements: { lastDepthOk: lastOk, error: e.name } };
      }
    }
  });

  // 5) TABLEAU TYPE GEANT : cherche la plus grande allocation contigue possible.
  R.register({
    id: 'fuzz.aggr.typedarray.giant', name: '⚠ Giant typed array (binary search)', category: CAT,
    destructive: true,
    description: 'Binary-searches the largest allocatable Uint8Array (up to 4 GB). May crash via OOM.',
    requires: ['typedArrays.Uint8Array'],
    run: function (ctx) {
      // Dichotomie sur la taille : borne haute volontairement enorme (2^32-1).
      var lo = 0, hi = 4294967295, best = 0;
      try {
        while (lo <= hi) {
          ctx.tick();
          var midNum = lo + Math.floor((hi - lo) / 2);
          var ok = true;
          try {
            var ta = new Uint8Array(midNum);
            ta[0] = 1; ta[ta.length - 1] = 1; // touche les extremites -> engagement reel
            ta = null;
          } catch (e) { ok = false; if (!G.isAbort(e)) { /* alloc fail */ } else throw e; }
          if (ok) { best = midNum; lo = midNum + 1; } else { hi = midNum - 1; }
          ctx.metric('dichotomie', { essai: midNum, ok: ok, meilleurMo: mb(best) });
        }
        return { status: 'pass', detail: 'plus grande Uint8Array allouee ~' + mb(best) + ' Mo (' + best + ' octets)',
                 measurements: { maxBytes: best, maxMo: mb(best) } };
      } catch (e2) {
        if (G.isAbort(e2)) return { status: 'aborted', detail: 'stopped; best ~' + mb(best) + ' Mo', measurements: { maxBytes: best } };
        return { status: 'pass', detail: 'interrompu par ' + e2.name + ' ; best ~' + mb(best) + ' Mo', measurements: { maxBytes: best, error: e2.name } };
      }
    }
  });

  // 6) BACKTRACKING REGEX CATASTROPHIQUE : NON borne. Peut FIGER l'onglet.
  R.register({
    id: 'fuzz.aggr.regex.freeze', name: '⚠⚠ Catastrophic regex (may freeze the tab)', category: CAT,
    destructive: true,
    description: 'Pattern (a+)+$ on ever-longer inputs: time explodes. THIS TEST MAY FREEZE THE BROWSER.',
    run: function (ctx) {
      var re = /(a+)+$/;
      var results = [];
      var lengths = [20, 24, 28, 30, 32, 34, 36, 38, 40, 44, 48];
      ctx.info('WARNING: a synchronous .test() call CANNOT be interrupted by Stop.');
      for (var i = 0; i < lengths.length; i++) {
        var len = lengths[i];
        var str = new Array(len + 1).join('a') + 'X'; // ne matche jamais -> pire cas
        ctx.info('attempt length ' + len + ' (tas ~' + heapMB() + ' Mo) ...'); // journalise AVANT : trace si ca gele ici
        var t0 = PSWKT.now();
        var matched = re.test(str);      // <-- peut ne jamais revenir
        var dt = PSWKT.now() - t0;
        results.push({ len: len, ms: Math.round(dt * 100) / 100, matched: matched });
        ctx.metric('length ' + len, { ms: Math.round(dt * 100) / 100 });
        ctx.tick(); // point d arret entre deux longueurs (pas pendant l appel)
        if (dt > 10000) { ctx.info('> 10 s on a single length: stopping the ramp-up.'); break; }
      }
      var worst = results.length ? results[results.length - 1] : null;
      return { status: 'pass',
               detail: 'backtracking measured up to length ' + (worst ? worst.len : '?') + ' (' + (worst ? worst.ms : '?') + ' ms)',
               measurements: { timings: results } };
    }
  });

  // 7) CHURN SYNCHRONE : boucle d'allocation serree pour saturer le GC.
  R.register({
    id: 'fuzz.aggr.gc.churn', name: '⚠ GC churn (tight allocation)', category: CAT,
    destructive: true,
    description: 'Creates millions of ephemeral objects in a tight loop to hammer the garbage collector. Reports the rate.',
    run: function (ctx) {
      var sink = null, made = 0;
      var target = 50000000;        // 50 M objets : tres long, prevu pour etre arrete par l echeance filet
      var t0 = PSWKT.now();
      try {
        for (var i = 0; i < target; i++) {
          sink = { a: i, b: 'x' + (i & 1023), c: [i, i + 1], d: { e: i } };
          made++;
          if ((i & 65535) === 0) ctx.tick(); // Stop/echeance tous les 64k
        }
      } catch (e) {
        if (G.isAbort(e)) {
          var dt = PSWKT.now() - t0;
          return { status: 'aborted', detail: made + ' objects in ' + Math.round(dt) + ' ms (' + Math.round(made / (dt / 1000)) + '/s)',
                   measurements: { objects: made, ms: Math.round(dt), perSec: Math.round(made / (dt / 1000)), tasMo: heapMB() } };
        }
        throw e;
      }
      var dt2 = PSWKT.now() - t0;
      void sink;
      return { status: 'pass', detail: made + ' objects created in ' + Math.round(dt2) + ' ms',
               measurements: { objects: made, ms: Math.round(dt2), perSec: Math.round(made / (dt2 / 1000)) } };
    }
  });

  // 8) TABLEAU DENSE GEANT : materialise un tableau enorme jusqu'a l'echec.
  R.register({
    id: 'fuzz.aggr.array.fill', name: '⚠ Giant dense array (fill)', category: CAT,
    destructive: true,
    description: 'Grows a dense array via push until memory saturation (or crash). Reports the size reached.',
    run: function (ctx) {
      var arr = [], n = 0;
      var chunk = 1000000; // 1 M elements par palier
      try {
        while (true) {
          ctx.tick();
          for (var i = 0; i < chunk; i++) arr.push(i);
          n += chunk;
          ctx.metric('size', { elements: n, tasMo: heapMB() });
        }
      } catch (e) {
        if (G.isAbort(e)) return { status: 'aborted', detail: 'stopped at ' + n + ' elements', measurements: { elements: n } };
        return { status: 'pass', detail: 'array saturated at ~' + n + ' elements (' + e.name + ')',
                 measurements: { maxElements: n, error: e.name } };
      } finally { arr = null; }
    }
  });

})(typeof window !== 'undefined' ? window : this);
