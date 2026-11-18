/*
 * PSWKT - Tests : gestion des allocations et de la memoire
 * Observations reproductibles et non destructives, sous budget strict.
 * Note : aucun de ces tests ne "casse" la memoire ; ils mesurent et documentent
 * le comportement d'allocation/liberation du moteur.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('memory', 'Allocations & memory', 'Controlled memory pressure, release, WeakRef, heap measurement.');

  // 1) Lecture du tas JS (API non standard performance.memory).
  R.register({
    id: 'mem.heap.read',
    name: 'JS heap read',
    category: 'memory',
    description: 'Reads performance.memory if available (otherwise skipped).',
    requires: ['timing.performanceMemory'],
    run: function (ctx) {
      var h = PSWKT.guard.readHeap();
      ctx.tick();
      if (!h) return { status: 'skip', detail: 'performance.memory unavailable', measurements: null };
      return {
        status: 'pass',
        detail: 'utilise ' + Math.round(h.usedJSHeapSize / 1048576) + ' Mo / limite ' +
          Math.round(h.jsHeapSizeLimit / 1048576) + ' Mo',
        measurements: {
          usedMB: Math.round(h.usedJSHeapSize / 1048576 * 100) / 100,
          totalMB: Math.round(h.totalJSHeapSize / 1048576 * 100) / 100,
          limitMB: Math.round(h.jsHeapSizeLimit / 1048576 * 100) / 100
        }
      };
    }
  });

  // 2) Pression memoire controlee : alloue puis libere, observe le tas si possible.
  R.register({
    id: 'mem.pressure.cycle',
    name: 'Allocation / release cycle',
    category: 'memory',
    description: 'Allocates buffers under budget, measures the heap, releases, re-measures.',
    requires: ['typedArrays.ArrayBuffer'],
    run: function (ctx) {
      var before = PSWKT.guard.readHeap();
      var blockBytes = 2 * 1024 * 1024; // 2 Mo
      var blocks = [];
      while (ctx.charge(blockBytes) && blocks.length < 256) {
        ctx.tick();
        var buf = new Uint8Array(blockBytes);
        buf[0] = 1; buf[blockBytes - 1] = 2; // touche la memoire
        blocks.push(buf);
      }
      var peak = PSWKT.guard.readHeap();
      var allocatedMB = Math.round(blocks.length * blockBytes / 1048576);
      blocks.length = 0; // libere les references
      ctx.tick();
      var after = PSWKT.guard.readHeap();
      var m = {
        blocks: blocks.length,
        allocatedMB: allocatedMB,
        heapBeforeMB: before ? Math.round(before.usedJSHeapSize / 1048576) : null,
        heapPeakMB: peak ? Math.round(peak.usedJSHeapSize / 1048576) : null,
        heapAfterMB: after ? Math.round(after.usedJSHeapSize / 1048576) : null
      };
      // Statut : l'allocation a reussi sans depasser le budget ni plantage.
      return {
        status: 'pass',
        detail: allocatedMB + ' Mo alloues puis liberes' +
          (peak ? (', tas pic ~' + m.heapPeakMB + ' Mo') : ' (tas non mesurable)'),
        measurements: m
      };
    }
  });

  // 3) WeakRef / FinalizationRegistry : presence et comportement de base.
  R.register({
    id: 'mem.weakref',
    name: 'WeakRef (presence et deref)',
    category: 'memory',
    description: 'Creates a WeakRef and checks deref() while the target is alive.',
    requires: ['objects.WeakRef'],
    run: function (ctx) {
      var obj = { marker: 'vivant' };
      var ref = new global.WeakRef(obj);
      ctx.tick();
      var alive = (ref.deref() === obj);
      // On ne force pas le GC (impossible de maniere portable) ; on documente l'etat vivant.
      return {
        status: alive ? 'pass' : 'fail',
        detail: 'deref() rend la cible vivante=' + alive + ' (le GC ne peut etre force de maniere portable)',
        measurements: { aliveDeref: alive }
      };
    }
  });

  // 4) Fragmentation : alloue/libere en alternance, verifie l'absence de plantage.
  R.register({
    id: 'mem.churn',
    name: 'Allocation churn',
    category: 'memory',
    description: 'Alloue et libere rapidement de petits buffers pour solliciter le GC.',
    requires: ['typedArrays.ArrayBuffer'],
    run: function (ctx) {
      var iterations = 20000;
      var liveWindow = [];
      var windowSize = 64;
      var t0 = PSWKT.now();
      for (var i = 0; i < iterations; i++) {
        var b = new Uint8Array(4096);
        b[0] = i & 255;
        liveWindow.push(b);
        if (liveWindow.length > windowSize) liveWindow.shift(); // libere les plus anciens
        if ((i & 0x3FF) === 0) ctx.tick(0x3FF);
      }
      var dt = PSWKT.now() - t0;
      var stillLive = liveWindow.length;
      liveWindow.length = 0;
      return {
        status: 'pass',
        detail: iterations + ' cycles alloc/liberation en ' + Math.round(dt) + ' ms, fenetre vivante=' + stillLive,
        measurements: {
          iterations: iterations, ms: Math.round(dt * 100) / 100,
          allocPerSec: dt > 0 ? Math.round(iterations / (dt / 1000)) : null
        }
      };
    }
  });

  // 5) Grosse chaine : construction et mesure (allocation de chaines).
  R.register({
    id: 'mem.string.build',
    name: 'Large string building',
    category: 'memory',
    description: 'Builds a ~1M-character string by join and measures the duration.',
    requires: [],
    run: function (ctx) {
      var n = 1000000;
      if (!ctx.charge(n * 2)) {
        return { status: 'skip', detail: 'insufficient budget for ~2 MB string', measurements: null };
      }
      var parts = new Array(n / 10);
      for (var i = 0; i < parts.length; i++) {
        parts[i] = '0123456789';
        if ((i & 0x3FFF) === 0) ctx.tick(0x3FFF);
      }
      var t0 = PSWKT.now();
      var big = parts.join('');
      var dt = PSWKT.now() - t0;
      var ok = (big.length === n);
      parts.length = 0;
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'string of ' + big.length + ' caracteres construite en ' + Math.round(dt * 100) / 100 + ' ms',
        measurements: { length: big.length, joinMs: Math.round(dt * 100) / 100, expected: n }
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
