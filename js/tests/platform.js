/*
 * PSWKT - Tests : plateforme (Worker, WebAssembly, crypto, stockage, Intl)
 * Techniques variees : Blob+Worker avec round-trip asynchrone, instanciation WASM,
 * crypto.subtle (Promise), stockage synchrone, formatage i18n.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var G = PSWKT.guard;

  R.defineCategory('platform', 'Platform & APIs', 'Web Worker, WebAssembly, crypto, localStorage, Intl.');

  // 1) Web Worker : cree via Blob, aller-retour de message.
  R.register({
    id: 'plat.worker.roundtrip',
    name: 'Web Worker (round-trip)',
    category: 'platform',
    description: 'Creates a worker from a Blob, sends it a number, receives the double.',
    requires: ['platform.Worker', 'platform.Blob', 'platform.URLcreateObjectURL'],
    run: function (ctx) {
      var src = 'self.onmessage=function(e){var n=e.data;var s=0;for(var i=0;i<n;i++){s+=i;}self.postMessage({doubled:n*2,sum:s});};';
      var url = global.URL.createObjectURL(new global.Blob([src], { type: 'text/javascript' }));
      ctx.info('worker cree depuis Blob URL');
      var worker;
      try { worker = new global.Worker(url); }
      catch (e) {
        try { global.URL.revokeObjectURL(url); } catch (x) {}
        return Promise.resolve({ status: 'skip', detail: 'creation worker refusee : ' + e.message, measurements: null });
      }
      var p = new Promise(function (resolve, reject) {
        worker.onmessage = function (ev) { resolve(ev.data); };
        worker.onerror = function (ev) { reject(new Error('worker : ' + (ev.message || 'erreur'))); };
        ctx.info('envoi de 1000 au worker...');
        worker.postMessage(1000);
      }).then(function (data) {
        ctx.info('reponse worker : double=' + data.doubled + ', somme=' + data.sum);
        var ok = (data.doubled === 2000 && data.sum === 499500);
        return { status: ok ? 'pass' : 'fail', detail: 'double=' + data.doubled + ', somme(0..999)=' + data.sum, measurements: data };
      });
      return G.withTimeout(p, Math.min(4000, ctx.budget.timeLeftMs()), 'worker').then(function (r) {
        try { worker.terminate(); } catch (e) {}
        try { global.URL.revokeObjectURL(url); } catch (e) {}
        return r;
      }, function (err) {
        try { worker.terminate(); } catch (e) {}
        try { global.URL.revokeObjectURL(url); } catch (e) {}
        throw err;
      });
    }
  });

  // 2) WebAssembly : instancie un module minimal (add) et l'appelle.
  R.register({
    id: 'plat.wasm.add',
    name: 'WebAssembly (module add)',
    category: 'platform',
    description: 'Instantiates a minimal WASM module exporting add(i32,i32) and checks 7+35=42.',
    requires: ['platform.WebAssembly'],
    run: function (ctx) {
      // Module : (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add)
      var bytes = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
        0x03, 0x02, 0x01, 0x00,
        0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
        0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b
      ]);
      ctx.info('instanciation d un module WASM de ' + bytes.length + ' octets...');
      var p = global.WebAssembly.instantiate(bytes).then(function (res) {
        var add = res.instance.exports.add;
        var r1 = add(7, 35);
        var r2 = add(-10, 4);
        ctx.info('add(7,35)=' + r1 + ', add(-10,4)=' + r2);
        var ok = (r1 === 42 && r2 === -6);
        return { status: ok ? 'pass' : 'fail', detail: 'add(7,35)=' + r1 + ', add(-10,4)=' + r2, measurements: { r1: r1, r2: r2, bytes: bytes.length } };
      });
      return G.withTimeout(p, Math.min(4000, ctx.budget.timeLeftMs()), 'wasm');
    }
  });

  // 3) crypto.getRandomValues : entropie et plage.
  R.register({
    id: 'plat.crypto.random',
    name: 'crypto.getRandomValues',
    category: 'platform',
    description: 'Fills a 1024-byte random array and checks the distribution.',
    requires: ['platform.crypto'],
    run: function (ctx) {
      var buf = new Uint8Array(1024);
      global.crypto.getRandomValues(buf);
      var sum = 0, zeros = 0, distinct = {};
      for (var i = 0; i < buf.length; i++) {
        sum += buf[i];
        if (buf[i] === 0) zeros++;
        distinct[buf[i]] = 1;
      }
      var mean = sum / buf.length;
      var distinctCount = Object.keys(distinct).length;
      ctx.info('moyenne=' + Math.round(mean * 100) / 100 + ' (attendu ~127.5), valeurs distinctes=' + distinctCount + '/256');
      // Heuristique simple de sanite (pas un test statistique rigoureux) :
      var ok = (mean > 100 && mean < 155 && distinctCount > 200);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'moyenne=' + Math.round(mean * 100) / 100 + ', distinctes=' + distinctCount + '/256',
        measurements: { mean: Math.round(mean * 100) / 100, distinct: distinctCount, zeros: zeros }
      };
    }
  });

  // 4) crypto.subtle.digest : SHA-256 d'une valeur connue (asynchrone).
  R.register({
    id: 'plat.crypto.sha256',
    name: 'SHA-256 (crypto.subtle)',
    category: 'platform',
    description: 'Calcule SHA-256("abc") et compare au condense de reference.',
    requires: ['platform.cryptoSubtle', 'platform.TextEncoder'],
    run: function (ctx) {
      var data = new TextEncoder().encode('abc');
      ctx.info('calcul SHA-256 de "abc"...');
      var p = global.crypto.subtle.digest('SHA-256', data).then(function (hashBuf) {
        var view = new Uint8Array(hashBuf);
        var hex = '';
        for (var i = 0; i < view.length; i++) { hex += ('0' + view[i].toString(16)).slice(-2); }
        var expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
        ctx.info('condense = ' + hex);
        var ok = (hex === expected);
        return { status: ok ? 'pass' : 'fail', detail: ok ? 'SHA-256 conforme a la reference' : 'condense inattendu', measurements: { hash: hex, matchesReference: ok } };
      });
      return G.withTimeout(p, Math.min(4000, ctx.budget.timeLeftMs()), 'sha256');
    }
  });

  // 5) localStorage : aller-retour et nettoyage (non destructif : cle dediee, retiree ensuite).
  R.register({
    id: 'plat.storage.roundtrip',
    name: 'localStorage (round-trip)',
    category: 'platform',
    description: 'Ecrit puis relit une cle dediee, puis la supprime (non destructif).',
    requires: ['platform.localStorage'],
    run: function (ctx) {
      var key = '__pswkt_probe__';
      var payload = JSON.stringify({ n: 42, s: 'test', ts: Date.now() });
      var ok = false, readback = null;
      try {
        global.localStorage.setItem(key, payload);
        readback = global.localStorage.getItem(key);
        ok = (readback === payload);
        ctx.info('ecriture/lecture localStorage : ' + ok);
      } catch (e) {
        ctx.info('localStorage inaccessible : ' + e.message);
        return { status: 'skip', detail: 'localStorage inaccessible : ' + e.message, measurements: null };
      } finally {
        try { global.localStorage.removeItem(key); } catch (e) {}
      }
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'round-trip=' + ok + ', cle nettoyee',
        measurements: { roundTrip: ok, bytes: payload.length }
      };
    }
  });

  // 6) Intl : formatage des nombres et dates (i18n).
  R.register({
    id: 'plat.intl',
    name: 'Intl (numbers, dates, sorting)',
    category: 'platform',
    description: 'Formats a number and a date, sorts with Collator.',
    requires: ['lang.Intl'],
    run: function (ctx) {
      var out = {};
      try {
        if (global.Intl.NumberFormat) {
          out.number = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1234567.89);
          ctx.info('nombre fr-FR EUR : ' + out.number);
        }
        if (global.Intl.DateTimeFormat) {
          out.date = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(2026, 0, 15));
          ctx.info('date fr-FR : ' + out.date);
        }
        if (global.Intl.Collator) {
          var arr = ['z', 'e', 'a', 'é', 'b'];
          out.sorted = arr.slice().sort(new Intl.Collator('fr-FR').compare);
          ctx.info('tri Collator fr-FR : ' + out.sorted.join(', '));
        }
      } catch (e) {
        return { status: 'fail', detail: 'Intl error: ' + e.message, measurements: out };
      }
      var hasAny = !!(out.number || out.date || out.sorted);
      return {
        status: hasAny ? 'pass' : 'skip',
        detail: 'nombre : ' + (out.number || 'n/a') + ' | date : ' + (out.date || 'n/a'),
        measurements: out
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
