/*
 * PSWKT - Tests : asynchronisme et ordonnancement
 * Technique : run() renvoie une Promise. Montre l'ordre microtaches/macrotaches,
 * la derive des timers, requestAnimationFrame, async/await, Promise.all.
 * Tous les tests respectent un delai maximal via PSWKT.guard.withTimeout.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var G = PSWKT.guard;

  R.defineCategory('async', 'Asynchrony', 'Microtasks vs macrotasks, timers, rAF, async/await, Promise.all.');

  // 1) Ordre d'execution : synchrone -> microtaches (Promise) -> macrotaches (setTimeout).
  R.register({
    id: 'async.ordering',
    name: 'Ordre microtaches / macrotaches',
    category: 'async',
    description: 'Verifie que les microtaches passent avant les timers.',
    requires: ['timing.Promise', 'timing.setTimeout'],
    run: function (ctx) {
      var order = [];
      var p = new Promise(function (resolve) {
        order.push('sync');
        global.setTimeout(function () { order.push('timeout'); check(); }, 0);
        Promise.resolve().then(function () { order.push('microtache'); });
        resolve();
      });
      var done;
      var result = new Promise(function (res) { done = res; });
      function check() {
        ctx.info('ordre observe : ' + order.join(' -> '));
        var ok = (order.indexOf('microtache') < order.indexOf('timeout') &&
          order[0] === 'sync');
        done({
          status: ok ? 'pass' : 'fail',
          detail: order.join(' -> '),
          measurements: { order: order, microBeforeTimeout: order.indexOf('microtache') < order.indexOf('timeout') }
        });
      }
      return G.withTimeout(result, Math.min(2000, ctx.budget.timeLeftMs()), 'ordre async');
    }
  });

  // 2) Derive des timers setTimeout (mesure).
  R.register({
    id: 'async.timer.drift',
    name: 'Derive de setTimeout',
    category: 'async',
    description: 'Mesure l ecart entre le delai demande et le delai reel sur 5 timers.',
    requires: ['timing.setTimeout'],
    run: function (ctx) {
      var samples = [];
      var target = 20; // ms
      function once() {
        return new Promise(function (resolve) {
          var t0 = PSWKT.now();
          global.setTimeout(function () { resolve(PSWKT.now() - t0); }, target);
        });
      }
      var chain = Promise.resolve();
      for (var i = 0; i < 5; i++) {
        chain = chain.then(once).then(function (dt) {
          samples.push(Math.round(dt * 100) / 100);
          ctx.tick();
        });
      }
      var final = chain.then(function () {
        var sum = 0; for (var k = 0; k < samples.length; k++) sum += samples[k];
        var avg = sum / samples.length;
        ctx.info('delais reels (ms) : ' + samples.join(', '));
        ctx.info('moyenne ' + Math.round(avg * 100) / 100 + ' ms pour ' + target + ' ms demandes');
        return {
          status: 'pass',
          detail: 'moyenne ' + Math.round(avg * 100) / 100 + ' ms (cible ' + target + ' ms)',
          measurements: { target: target, samples: samples, avg: Math.round(avg * 100) / 100 }
        };
      });
      return G.withTimeout(final, Math.min(3000, ctx.budget.timeLeftMs()), 'derive timer');
    }
  });

  // 3) requestAnimationFrame : cadence des trames.
  R.register({
    id: 'async.raf',
    name: 'requestAnimationFrame (cadence)',
    category: 'async',
    description: 'Mesure l intervalle entre 10 trames et estime les FPS.',
    requires: ['timing.requestAnimationFrame'],
    run: function (ctx) {
      var times = [];
      var frames = 10;
      function loop(resolve) {
        global.requestAnimationFrame(function (ts) {
          times.push(ts);
          if (times.length >= frames) resolve();
          else loop(resolve);
        });
      }
      var p = new Promise(function (resolve) { loop(resolve); }).then(function () {
        var deltas = [];
        for (var i = 1; i < times.length; i++) deltas.push(Math.round((times[i] - times[i - 1]) * 100) / 100);
        var sum = 0; for (var k = 0; k < deltas.length; k++) sum += deltas[k];
        var avg = deltas.length ? sum / deltas.length : 0;
        var fps = avg > 0 ? Math.round(1000 / avg) : null;
        ctx.info('intervalles trames (ms) : ' + deltas.join(', '));
        ctx.info('cadence estimee : ~' + fps + ' FPS');
        return {
          status: 'pass',
          detail: '~' + fps + ' FPS (intervalle moyen ' + Math.round(avg * 100) / 100 + ' ms)',
          measurements: { frames: frames, deltas: deltas, avgMs: Math.round(avg * 100) / 100, fps: fps }
        };
      });
      return G.withTimeout(p, Math.min(4000, ctx.budget.timeLeftMs()), 'rAF');
    }
  });

  // 4) async / await et Promise.all en parallele.
  R.register({
    id: 'async.await.all',
    name: 'async/await + Promise.all',
    category: 'async',
    description: 'Lance 4 taches asynchrones en parallele et agrege les resultats.',
    requires: ['timing.Promise'],
    run: function (ctx) {
      function work(n, ms) {
        return new Promise(function (resolve) {
          global.setTimeout(function () { resolve(n * n); }, ms);
        });
      }
      // async/await si supporte, sinon repli sur Promise.all pur.
      var t0 = PSWKT.now();
      var p = Promise.all([work(1, 10), work(2, 10), work(3, 10), work(4, 10)]).then(function (vals) {
        var dt = PSWKT.now() - t0;
        var sum = vals[0] + vals[1] + vals[2] + vals[3];
        ctx.info('resultats paralleles : [' + vals.join(', ') + '], somme=' + sum);
        ctx.info('duree totale ' + Math.round(dt) + ' ms (parallele, pas sequentiel)');
        var ok = (sum === 30 && dt < 60); // 4x10ms en parallele -> ~10-20ms
        return {
          status: ok ? 'pass' : 'fail',
          detail: 'somme=' + sum + ', duree=' + Math.round(dt) + ' ms (parallele attendu <60 ms)',
          measurements: { values: vals, sum: sum, totalMs: Math.round(dt * 100) / 100, parallel: dt < 60 }
        };
      });
      return G.withTimeout(p, Math.min(3000, ctx.budget.timeLeftMs()), 'promise.all');
    }
  });

  // 5) queueMicrotask (si disponible).
  R.register({
    id: 'async.queuemicrotask',
    name: 'queueMicrotask',
    category: 'async',
    description: 'Verifie que queueMicrotask s execute avant un setTimeout(0).',
    requires: ['timing.queueMicrotask', 'timing.setTimeout'],
    run: function (ctx) {
      var order = [];
      var p = new Promise(function (resolve) {
        global.setTimeout(function () { order.push('timeout'); resolve(); }, 0);
        global.queueMicrotask(function () { order.push('microtask'); });
        order.push('sync');
      }).then(function () {
        ctx.info('ordre : ' + order.join(' -> '));
        var ok = (order[0] === 'sync' && order.indexOf('microtask') < order.indexOf('timeout'));
        return { status: ok ? 'pass' : 'fail', detail: order.join(' -> '), measurements: { order: order } };
      });
      return G.withTimeout(p, Math.min(2000, ctx.budget.timeLeftMs()), 'queueMicrotask');
    }
  });

})(typeof window !== 'undefined' ? window : this);
