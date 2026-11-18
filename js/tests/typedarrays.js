/*
 * PSWKT - Tests : tableaux types (TypedArrays / ArrayBuffer / DataView)
 * Tous reproductibles et non destructifs.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('typedarrays', 'Typed arrays', 'ArrayBuffer, typed views, DataView, allocations.');

  // 1) Aller-retour ecriture/lecture sur chaque type disponible.
  R.register({
    id: 'ta.roundtrip',
    name: 'Read/write round-trip per type',
    category: 'typedarrays',
    description: 'Ecrit puis relit des valeurs representatives dans chaque vue typee.',
    requires: ['typedArrays.ArrayBuffer'],
    run: function (ctx) {
      var types = [
        { name: 'Int8Array', min: -128, max: 127 },
        { name: 'Uint8Array', min: 0, max: 255 },
        { name: 'Uint8ClampedArray', min: 0, max: 255 },
        { name: 'Int16Array', min: -32768, max: 32767 },
        { name: 'Uint16Array', min: 0, max: 65535 },
        { name: 'Int32Array', min: -2147483648, max: 2147483647 },
        { name: 'Uint32Array', min: 0, max: 4294967295 },
        { name: 'Float32Array', min: -1.5, max: 1.5 },
        { name: 'Float64Array', min: -1.5, max: 1.5 }
      ];
      var results = {};
      var failures = [];
      for (var i = 0; i < types.length; i++) {
        ctx.tick();
        var def = types[i];
        var Ctor = global[def.name];
        if (typeof Ctor !== 'function') { results[def.name] = 'absent'; continue; }
        var arr = new Ctor(4);
        arr[0] = def.min; arr[1] = def.max; arr[2] = 0; arr[3] = (def.min + def.max) / 2;
        var ok = true;
        // Pour les flottants on tolere l'imprecision ; pour les entiers on exige l'egalite.
        var isFloat = def.name.indexOf('Float') === 0;
        if (isFloat) {
          ok = Math.abs(arr[0] - def.min) < 1e-3 && Math.abs(arr[1] - def.max) < 1e-3;
        } else {
          ok = (arr[0] === def.min && arr[1] === def.max && arr[2] === 0);
        }
        results[def.name] = ok ? 'ok' : ('incoherent: [' + arr[0] + ',' + arr[1] + ',' + arr[2] + ']');
        if (!ok) failures.push(def.name);
      }
      return {
        status: failures.length ? 'fail' : 'pass',
        detail: failures.length ? ('types incoherents : ' + failures.join(', ')) : 'tous les types testes sont coherents',
        measurements: results
      };
    }
  });

  // 2) Endianness via DataView (comportement documente, non suppose).
  R.register({
    id: 'ta.dataview.endian',
    name: 'DataView - endianness',
    category: 'typedarrays',
    description: 'Writes 0x01020304 in little and big endian and reads back the bytes.',
    requires: ['typedArrays.DataView'],
    run: function (ctx) {
      var buf = new ArrayBuffer(4);
      var dv = new DataView(buf);
      dv.setUint32(0, 0x01020304, true); // little endian
      var le = [dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)];
      dv.setUint32(0, 0x01020304, false); // big endian
      var be = [dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)];
      ctx.tick();
      var leOk = le.join(',') === '4,3,2,1';
      var beOk = be.join(',') === '1,2,3,4';
      return {
        status: (leOk && beOk) ? 'pass' : 'fail',
        detail: 'LE=' + le.join(',') + ' BE=' + be.join(','),
        measurements: { littleEndianBytes: le, bigEndianBytes: be, leOk: leOk, beOk: beOk }
      };
    }
  });

  // 3) set() / subarray() / slice() corrects.
  R.register({
    id: 'ta.views',
    name: 'Shared views (subarray/set/slice)',
    category: 'typedarrays',
    description: 'Checks memory sharing (subarray) and copying (slice).',
    requires: ['typedArrays.Uint16Array'],
    run: function (ctx) {
      var a = new Uint16Array([10, 20, 30, 40, 50, 60]);
      var sub = a.subarray(1, 4); // partage la memoire : [20,30,40]
      sub[0] = 999;               // doit modifier a[1]
      ctx.tick();
      var shared = (a[1] === 999);
      var copy = a.slice(1, 4);   // copie independante
      copy[0] = 123;              // ne doit PAS modifier a[1]
      var independent = (a[1] === 999);
      var dst = new Uint16Array(3);
      dst.set(a.subarray(0, 3));
      var setOk = (dst[0] === a[0] && dst[1] === a[1] && dst[2] === a[2]);
      var ok = shared && independent && setOk;
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'subarray partage=' + shared + ', slice independant=' + independent + ', set=' + setOk,
        measurements: { shared: shared, independent: independent, setOk: setOk }
      };
    }
  });

  // 4) Acces hors limites : doit renvoyer undefined, sans lever (non destructif).
  R.register({
    id: 'ta.bounds',
    name: 'Out-of-bounds access (read)',
    category: 'typedarrays',
    description: 'Reads beyond bounds; expected: undefined, no crash.',
    requires: ['typedArrays.Int32Array'],
    run: function (ctx) {
      var a = new Int32Array(4);
      ctx.tick();
      var beyond = a[10];      // attendu : undefined
      var negative = a[-1];    // attendu : undefined
      var okBeyond = (beyond === undefined);
      var okNeg = (negative === undefined);
      // Ecriture hors limites : ignoree silencieusement en mode non-strict sur une vue typee.
      try { a[10] = 7; } catch (e) { /* documente ci-dessous */ }
      var writeIgnored = (a[10] === undefined);
      var ok = okBeyond && okNeg && writeIgnored;
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'read>len=' + beyond + ', lecture[-1]=' + negative + ', out-of-bounds write ignored=' + writeIgnored,
        measurements: { okBeyond: okBeyond, okNeg: okNeg, writeIgnored: writeIgnored }
      };
    }
  });

  // 5) Allocation progressive sous budget memoire (gestion des allocations).
  R.register({
    id: 'ta.alloc.budget',
    name: 'Progressive allocation under budget',
    category: 'typedarrays',
    description: 'Allocates Float64 blocks up to the memory budget, then releases.',
    requires: ['typedArrays.Float64Array'],
    run: function (ctx) {
      var blockBytes = 1 * 1024 * 1024; // 1 Mo par bloc
      var elems = blockBytes / 8;
      var blocks = [];
      var allocated = 0;
      var maxReached = false;
      while (true) {
        ctx.tick();
        if (!ctx.charge(blockBytes)) { maxReached = true; break; }
        var b = new Float64Array(elems);
        b[0] = 1; b[elems - 1] = 2; // touche la memoire pour forcer l'allocation reelle
        blocks.push(b);
        allocated += blockBytes;
        if (blocks.length > 4096) { maxReached = true; break; } // garde-fou dur supplementaire
      }
      var count = blocks.length;
      // Verifie l'integrite d'un echantillon avant liberation.
      var integrity = true;
      for (var i = 0; i < count; i += Math.max(1, Math.floor(count / 16))) {
        if (blocks[i][0] !== 1 || blocks[i][elems - 1] !== 2) { integrity = false; break; }
      }
      blocks.length = 0; // liberation : plus de references -> eligible au GC
      return {
        status: integrity ? 'pass' : 'fail',
        detail: 'blocs alloues=' + count + ' (' + Math.round(allocated / 1048576) + ' Mo), integrite=' + integrity +
          (maxReached ? ', budget atteint' : ''),
        measurements: { blocks: count, bytes: allocated, integrity: integrity, budgetReached: maxReached }
      };
    }
  });

  // 6) Debit lecture/ecriture (mesure de duree, reproductible).
  R.register({
    id: 'ta.throughput',
    name: 'Float64 sequential throughput',
    category: 'typedarrays',
    description: 'Measures the time to fill and sum a 1M-element array.',
    requires: ['typedArrays.Float64Array'],
    run: function (ctx) {
      var n = 1000000;
      if (!ctx.charge(n * 8)) {
        return { status: 'skip', detail: 'budget memoire insuffisant pour 8 Mo', measurements: null };
      }
      var a = new Float64Array(n);
      var tWrite0 = PSWKT.now();
      for (var i = 0; i < n; i++) {
        a[i] = i * 0.5;
        if ((i & 0x3FFFF) === 0) ctx.tick(0x3FFFF); // verifie l'echeance par paquets
      }
      var tWrite = PSWKT.now() - tWrite0;
      var tRead0 = PSWKT.now();
      var sum = 0;
      for (var j = 0; j < n; j++) {
        sum += a[j];
        if ((j & 0x3FFFF) === 0) ctx.tick(0x3FFFF);
      }
      var tRead = PSWKT.now() - tRead0;
      var expected = (n - 1) * n / 2 * 0.5;
      var ok = Math.abs(sum - expected) < 1; // tolerance flottante
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'write ' + Math.round(tWrite) + ' ms, lecture ' + Math.round(tRead) +
          ' ms, somme ' + (ok ? 'correcte' : 'incorrecte'),
        measurements: {
          elements: n,
          writeMs: Math.round(tWrite * 100) / 100,
          readMs: Math.round(tRead * 100) / 100,
          writeMElemPerSec: Math.round(n / (tWrite / 1000) / 1e6 * 100) / 100,
          sumOk: ok
        }
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
