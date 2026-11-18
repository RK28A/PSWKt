/*
 * PSWKT - FUZZ ROBUSTESSE (2) : davantage de cas limites
 * Non destructifs (sauf mention), bornes, captures. Documentent la reaction du
 * moteur a des entrees extremes mais valides.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var CAT = 'fuzz_robustness';
  function reg(o) { o.category = CAT; R.register(o); }

  // 1) Intl.NumberFormat / toLocaleString avec options extremes -> RangeError rattrapee.
  reg({
    id: 'fuzz.robust2.intl.extreme', name: 'Intl/toLocaleString extreme options',
    description: 'Class: option validation. Absurd fraction digits, unknown currencies -> caught RangeError.',
    run: function (ctx) {
      var out = {};
      function t(label, fn) { try { out[label] = String(fn()).slice(0, 24); } catch (e) { out[label] = 'throw:' + e.name; } }
      t('frac=-1', function () { return (1).toLocaleString(undefined, { minimumFractionDigits: -1 }); });
      t('frac=1000', function () { return (1).toLocaleString(undefined, { maximumFractionDigits: 1000 }); });
      t('devise XXX', function () { return (1).toLocaleString('fr', { style: 'currency', currency: 'ZZZ' }); });
      if (global.Intl && Intl.NumberFormat) {
        t('nf frac=100', function () { return new Intl.NumberFormat('fr', { minimumSignificantDigits: 100 }).format(1); });
        t('nf locale invalide', function () { return new Intl.NumberFormat('!!!').format(1); });
      }
      ctx.metric('intl', out);
      return { status: 'pass', detail: 'extreme Intl options documented', measurements: out };
    }
  });

  // 2) Dates aux frontieres de l'intervalle valide (+/- 8.64e15 ms).
  reg({
    id: 'fuzz.robust2.date.bounds', name: 'Dates at the boundaries',
    description: 'Class: time boundaries. +/-8640000000000000 valid, +/-1 beyond = Invalid Date.',
    run: function (ctx) {
      var MAX = 8640000000000000;
      var r = {
        max: new Date(MAX).getTime(), maxP1: new Date(MAX + 1).getTime(),
        min: new Date(-MAX).getTime(), minM1: new Date(-MAX - 1).getTime(),
        epoch: new Date(0).toISOString()
      };
      var ok = r.max === MAX && isNaN(r.maxP1) && r.min === -MAX && isNaN(r.minM1);
      ctx.metric('date bounds', r);
      return { status: ok ? 'pass' : 'fail', detail: ok ? 'frontieres coherentes' : 'frontieres INCORRECTES', measurements: r };
    }
  });

  // 3) String.repeat/padStart avec comptes enormes -> RangeError rattrapee (pas de plantage).
  reg({
    id: 'fuzz.robust2.string.huge', name: 'String huge counts',
    description: 'Class: allocation refused cleanly. Oversized repeat/padStart -> caught RangeError.',
    run: function (ctx) {
      var out = {};
      function t(label, fn) { try { out[label] = fn(); } catch (e) { out[label] = 'throw:' + e.name; } }
      t('repeat 2^31', function () { return 'ab'.repeat(2147483648) ? 'ok' : 'ok'; });
      t('repeat -1', function () { return 'a'.repeat(-1); });
      if (''.padStart) { t('padStart 2^31', function () { return 'a'.padStart(2147483648, '.').length; }); }
      t('repeat 1e9 (borne)', function () { try { return 'a'.repeat(1e9).length; } catch (e) { return 'throw:' + e.name; } });
      ctx.metric('string huge', out);
      return { status: 'pass', detail: 'huge counts documented', measurements: out };
    }
  });

  // 4) Array.from avec iterateur qui leve en plein milieu.
  reg({
    id: 'fuzz.robust2.iter.midthrow', name: 'Iterator that throws midway',
    description: 'Class: hostile callback. The iterator throws after a few values -> clean error, no corruption.',
    requires: ['objects.Symbol'],
    run: function (ctx) {
      var it = {}; var produced = 0;
      it[Symbol.iterator] = function () { var i = 0; return { next: function () { if (i >= 3) throw new Error('stop a 3'); produced++; return { value: i++, done: false }; } }; };
      var res = {};
      try { Array.from(it); res.from = 'ok(?)'; } catch (e) { res.from = e.name; }
      try { var a = []; for (var x of it) { a.push(x); if (a.length > 10) break; } res.forof = a.length; } catch (e) { res.forof = e.name; }
      ctx.metric('iter midthrow', res);
      return { status: 'pass', detail: 'iterateur fautif gere (' + produced + ' valeurs produites)', measurements: res };
    }
  });

  // 5) TextDecoder sur octets malformes (mode replacement vs fatal).
  reg({
    id: 'fuzz.robust2.textdecoder', name: 'TextDecoder malformed bytes',
    description: 'Class: tolerant/strict decoding. Invalid UTF-8 sequences -> U+FFFD or TypeError (fatal).',
    requires: ['platform.TextDecoder'],
    run: function (ctx) {
      var bad = new Uint8Array([0xFF, 0xFE, 0xC0, 0x80, 0xED, 0xA0, 0x80, 0xF8]);
      var r = {};
      try { r.replace = new TextDecoder().decode(bad); r.replaceLen = r.replace.length; delete r.replace; } catch (e) { r.replace = e.name; }
      try { new TextDecoder('utf-8', { fatal: true }).decode(bad); r.fatal = 'pas leve (?)'; } catch (e) { r.fatal = e.name; }
      ctx.metric('textdecoder', r);
      return { status: 'pass', detail: 'malformed decoding documented', measurements: r };
    }
  });

  // 6) URL : analyse de chaines malformees.
  reg({
    id: 'fuzz.robust2.url', name: 'Malformed URLs',
    description: 'Class: URL parsing. Invalid strings -> caught TypeError or normalization.',
    requires: [],
    run: function (ctx) {
      if (typeof URL !== 'function') return { status: 'skip', detail: 'URL unavailable' };
      var cand = ['', 'http://', 'http://[', 'ht!tp://x', '//no-scheme', 'http://a b', 'https://xn--/', 'http://user:pass@h:99999/', 'javascript:alert(1)', 'data:,x', 'http://' + new Array(2000).join('a') + '.com'];
      var out = [];
      for (var i = 0; i < cand.length; i++) {
        var r = { in: cand[i].slice(0, 20) };
        try { var u = new URL(cand[i]); r.ok = u.protocol; } catch (e) { r.ok = 'throw:' + e.name; }
        try { var u2 = new URL(cand[i], 'http://base.example/'); r.rel = u2.host; } catch (e) { r.rel = 'throw:' + e.name; }
        out.push(r); ctx.tick();
      }
      ctx.metric('url', out);
      return { status: 'pass', detail: 'malformed URL parsing documented', measurements: { cases: out } };
    }
  });

  // 7) Object.defineProperty : descripteurs incoherents.
  reg({
    id: 'fuzz.robust2.defineprop', name: 'defineProperty inconsistent descriptors',
    description: 'Class: descriptor validation. data+accessor, non-configurable redefinition -> caught TypeError.',
    run: function (ctx) {
      var out = {};
      try { Object.defineProperty({}, 'x', { value: 1, get: function () {} }); out.mix = 'pas leve (?)'; } catch (e) { out.mix = e.name; }
      try { var o = {}; Object.defineProperty(o, 'x', { value: 1, configurable: false }); Object.defineProperty(o, 'x', { value: 2 }); out.redef = 'pas leve (?)'; } catch (e) { out.redef = e.name; }
      try { var o2 = Object.freeze({ a: 1 }); o2.a = 2; out.frozenWrite = o2.a; } catch (e) { out.frozenWrite = e.name; }
      ctx.metric('defineprop', out);
      return { status: 'pass', detail: 'inconsistent descriptors documented', measurements: out };
    }
  });

  // 8) Comparateur de tri hostile (NaN / incoherent / qui leve).
  reg({
    id: 'fuzz.robust2.sort.comparator', name: 'Hostile sort comparator',
    description: 'Class: hostile callback. Comparators returning NaN, inconsistent or throwing -> no corruption.',
    run: function (ctx) {
      var out = {};
      try { var a = [3, 1, 2, 5, 4]; a.sort(function () { return NaN; }); out.nan = a.join(','); } catch (e) { out.nan = e.name; }
      try { var b = [3, 1, 2, 5, 4]; b.sort(function () { return Math.random() - 0.5; }); out.random = b.length; } catch (e) { out.random = e.name; }
      try { var c = [3, 1, 2]; c.sort(function () { throw new Error('cmp'); }); out.throws = 'pas leve (?)'; } catch (e) { out.throws = e.name; }
      try { var d = [5, 4, 3, 2, 1]; d.sort(function (x, y) { return x - y; }); out.normal = d.join(','); } catch (e) { out.normal = e.name; }
      ctx.metric('sort comparator', out);
      var ok = out.normal === '1,2,3,4,5';
      return { status: ok ? 'pass' : 'fail', detail: ok ? 'normal sort correct, hostile comparators handled' : 'normal sort INCORRECT', measurements: out };
    }
  });

  // 9) getter qui se supprime / se redefinit pendant l'acces.
  reg({
    id: 'fuzz.robust2.getter.mutate', name: 'Getter that mutates during access',
    description: 'Class: side effects during access. A getter that deletes/redefines its own property.',
    run: function (ctx) {
      var out = {}; var calls = 0;
      var o = {};
      Object.defineProperty(o, 'x', { configurable: true, get: function () { calls++; delete o.x; o.x = 'remplace'; return 'original'; } });
      try { out.first = o.x; out.second = o.x; out.calls = calls; } catch (e) { out.err = e.name; }
      ctx.metric('getter mutate', out);
      return { status: 'pass', detail: '1er=' + out.first + ', 2e=' + out.second, measurements: out };
    }
  });

  // 10) parseInt/parseFloat sur numeriques exotiques.
  reg({
    id: 'fuzz.robust2.parse.exotic', name: 'parseInt/parseFloat exotic inputs',
    description: 'Class: numeric coercion. Exotic inputs -> a number (or NaN), never an exception.',
    run: function (ctx) {
      var cand = ['  0x1F  ', '0b101', '0o17', '1e3', '1e', 'Infinity', '-0', '١٢٣', '½', '1,5', '1.2.3', '  +.5e+1  ', '0x', '.', '٠x1'];
      var out = [], allNum = true;
      for (var i = 0; i < cand.length; i++) {
        var pi = parseInt(cand[i], 10), pf = parseFloat(cand[i]), nn = Number(cand[i]);
        if (typeof pi !== 'number' || typeof pf !== 'number' || typeof nn !== 'number') allNum = false;
        out.push({ in: cand[i], parseInt: pi, parseFloat: pf, Number: isNaN(nn) ? 'NaN' : nn });
      }
      ctx.metric('parse exotic', out);
      return { status: allNum ? 'pass' : 'fail', detail: allNum ? 'toujours un nombre' : 'resultat non numerique', measurements: { cases: out } };
    }
  });

  // 11) RegExp quantificateur enorme a la compilation.
  reg({
    id: 'fuzz.robust2.regex.quant', name: 'RegExp huge quantifier',
    description: 'Class: regex compilation. {0,1000000}, wide classes -> compiles or SyntaxError, no crash.',
    run: function (ctx) {
      var pats = ['a{0,1000000}', 'a{1000000}', '(?:ab){0,500000}', '[\\u0000-\\uffff]{1,100000}', '(a|b|c|d){0,100000}'];
      var out = [];
      for (var i = 0; i < pats.length; i++) {
        var r = { p: pats[i] };
        try { var re = new RegExp(pats[i]); r.ok = re.test('ab'); } catch (e) { r.ok = 'throw:' + e.name; }
        out.push(r); ctx.tick();
      }
      ctx.metric('regex quant', out);
      return { status: 'pass', detail: 'huge quantifiers documented', measurements: { cases: out } };
    }
  });

  // 12) structuredClone de types natifs varies.
  reg({
    id: 'fuzz.robust2.clone.types', name: 'structuredClone of various types',
    description: 'Class: serialization coverage. Clones Date/RegExp/Map/Set/TypedArray/ArrayBuffer/Blob/Error.',
    requires: ['objects.structuredClone'],
    run: function (ctx) {
      var out = {};
      function t(label, val) { try { var c = structuredClone(val); out[label] = Object.prototype.toString.call(c); } catch (e) { out[label] = 'throw:' + e.name; } }
      t('Date', new Date(0)); t('RegExp', /x/gi); t('Map', new Map([[1, 2]])); t('Set', new Set([1, 2]));
      t('Uint8Array', new Uint8Array([1, 2, 3])); t('ArrayBuffer', new ArrayBuffer(8));
      t('Error', new Error('x')); t('BigInt', (typeof BigInt === 'function') ? BigInt(5) : 5);
      if (typeof Blob === 'function') t('Blob', new Blob(['x']));
      try { structuredClone(function () {}); out.func = 'pas leve (?)'; } catch (e) { out.func = e.name; }
      ctx.metric('clone types', out);
      return { status: 'pass', detail: 'cloning of various types documented', measurements: out };
    }
  });

})(typeof window !== 'undefined' ? window : this);
