/*
 * PSWKT - Comportements JS (correction, invariants)
 * Tests simples et deterministes qui EXERCENT reellement le moteur et verifient
 * un comportement attendu. reussi = conforme, echec = comportement incorrect.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('behaviors', 'Comportements JS', 'Verifications de correction : tableaux, chaines, nombres, dates, async, objets.');

  function T(id, name, requires, fn) {
    R.register({ id: 'beh.' + id, name: name, category: 'behaviors', requires: requires || [], run: fn });
  }
  function ok(cond, detail, meas) { return { status: cond ? 'pass' : 'fail', detail: detail, measurements: meas || null }; }

  T('array.sort.stable', 'Tri stable (Array.sort)', [], function () {
    var a = []; for (var i = 0; i < 50; i++) a.push({ k: i % 3, i: i });
    a.sort(function (x, y) { return x.k - y.k; });
    var stable = true, last = -1, lastI = -1;
    for (var j = 0; j < a.length; j++) { if (a[j].k === last && a[j].i < lastI) stable = false; last = a[j].k; lastI = a[j].i; }
    return ok(stable, stable ? 'tri stable' : 'tri NON stable');
  });
  T('array.flat.deep', 'Array.flat(Infinity)', [], function () {
    if (![].flat) return { status: 'skip', detail: 'flat absent' };
    var r = [1, [2, [3, [4, [5]]]]].flat(Infinity);
    return ok(r.join(',') === '1,2,3,4,5', 'aplati = ' + r.join(','), { r: r });
  });
  T('array.includes.nan', 'Array.includes(NaN)', [], function () {
    return ok([NaN].includes(NaN) && [NaN].indexOf(NaN) === -1, 'includes voit NaN, indexOf non');
  });
  T('array.holes', 'Trous vs undefined', [], function () {
    var sparse = [1, , 3]; var seen = 0; sparse.forEach(function () { seen++; });
    return ok(sparse.length === 3 && seen === 2, 'length 3, forEach saute le trou (' + seen + ')');
  });
  T('string.codepoints', 'Iteration par points de code', [], function () {
    var s = 'a😀b'; var arr = []; for (var c of s) arr.push(c);
    return ok(arr.length === 3 && arr[1] === '😀', 'emoji compte pour 1 (' + arr.length + ')');
  });
  T('string.normalize', 'Normalisation NFC/NFD', [], function () {
    if (!''.normalize) return { status: 'skip', detail: 'normalize absent' };
    var nfc = 'é'; var nfd = 'é';
    return ok(nfc.normalize('NFD') === nfd && nfd.normalize('NFC') === nfc, 'NFC<->NFD coherent');
  });
  T('string.replaceAll', 'String.replaceAll', [], function () {
    if (!''.replaceAll) return { status: 'skip', detail: 'replaceAll absent' };
    return ok('a-a-a'.replaceAll('-', '+') === 'a+a+a', 'remplacement global');
  });
  T('number.tofixed', 'Number.toFixed arrondi', [], function () {
    return ok((1.005).toFixed(2) === '1.00' && (2.5).toFixed(0) === '3', 'arrondi IEEE observe');
  });
  T('number.parseint.radix', 'parseInt radix', [], function () {
    return ok(parseInt('0x1F', 16) === 31 && parseInt('777', 8) === 511 && parseInt('zz', 36) === 1295, 'bases OK');
  });
  T('number.safe', 'Entiers surs', [], function () {
    return ok(!Number.isSafeInteger(Math.pow(2, 53)) && Number.isSafeInteger(Math.pow(2, 53) - 1), 'seuil 2^53');
  });
  T('math.identity', 'Identite trig (sin^2+cos^2)', [], function () {
    var x = 0.7, v = Math.sin(x) * Math.sin(x) + Math.cos(x) * Math.cos(x);
    return ok(Math.abs(v - 1) < 1e-12, 'sin^2+cos^2 = ' + v);
  });
  T('math.fround', 'Math.fround (float32)', [], function () {
    if (!Math.fround) return { status: 'skip', detail: 'fround absent' };
    return ok(Math.fround(1.1) !== 1.1 && Math.fround(1) === 1, 'perte float32 observee');
  });
  T('date.iso.roundtrip', 'Date ISO aller-retour', [], function () {
    var iso = '2024-06-15T12:30:45.123Z';
    return ok(new Date(iso).toISOString() === iso, 'ISO stable');
  });
  T('date.invalid', 'Date invalide = NaN', [], function () {
    return ok(isNaN(new Date('pas une date').getTime()), 'Invalid Date -> NaN');
  });
  T('json.number.precision', 'JSON precision nombres', [], function () {
    var v = 0.1 + 0.2;
    return ok(JSON.parse(JSON.stringify(v)) === v, 'aller-retour exact pour ' + v);
  });
  T('json.special', 'JSON NaN/Infinity -> null', [], function () {
    return ok(JSON.stringify([NaN, Infinity, -Infinity]) === '[null,null,null]', 'specials -> null');
  });
  T('object.key.order', 'Ordre des cles (entiers puis insertion)', [], function () {
    var o = {}; o.b = 1; o[2] = 1; o.a = 1; o[1] = 1;
    return ok(Object.keys(o).join(',') === '1,2,b,a', 'ordre = ' + Object.keys(o).join(','));
  });
  T('object.spread.order', 'Spread objet (derniere valeur gagne)', [], function () {
    var o = Object.assign({}, { a: 1 }, { a: 2 });
    return ok(o.a === 2, 'a = ' + o.a);
  });
  T('map.order', 'Map garde l ordre d insertion', ['objects.Map'], function () {
    var m = new Map(); m.set('z', 1); m.set('a', 2); m.set('m', 3);
    var keys = []; m.forEach(function (v, k) { keys.push(k); });
    return ok(keys.join(',') === 'z,a,m', 'ordre = ' + keys.join(','));
  });
  T('set.dedup', 'Set deduplique (SameValueZero)', ['objects.Set'], function () {
    var s = new Set([1, 1, NaN, NaN, 0, -0]);
    return ok(s.size === 3, 'taille = ' + s.size + ' (attendu 3)');
  });
  T('structuredclone.deep', 'structuredClone copie profonde', ['objects.structuredClone'], function () {
    var o = { a: [1, 2, { b: 3 }], d: new Date(0) };
    var c = structuredClone(o);
    return ok(c !== o && c.a[2] !== o.a[2] && c.a[2].b === 3 && c.d.getTime() === 0, 'copie profonde independante');
  });
  T('proxy.trap', 'Proxy get/set', ['objects.Proxy'], function () {
    var log = []; var p = new Proxy({}, { get: function (t, k) { log.push('g:' + String(k)); return t[k]; }, set: function (t, k, v) { log.push('s:' + String(k)); t[k] = v; return true; } });
    p.x = 1; void p.x;
    return ok(log.indexOf('s:x') !== -1 && log.indexOf('g:x') !== -1, 'trappes declenchees');
  });
  T('reflect.ownkeys', 'Reflect.ownKeys ordre', ['objects.Reflect'], function () {
    var s = typeof Symbol === 'function' ? Symbol('s') : null;
    var o = {}; o[2] = 1; o.a = 1; o[1] = 1; if (s) o[s] = 1;
    var k = Reflect.ownKeys(o).map(String);
    return ok(k[0] === '1' && k[1] === '2', 'entiers d abord : ' + k.join(','));
  });
  T('bigint.exact', 'BigInt exact', ['lang.BigInt'], function () {
    /* global BigInt */
    var a = BigInt('9007199254740993');
    return ok(a + BigInt(0) === a && (a).toString() === '9007199254740993', 'exactitude 2^53+1');
  });
  T('typedarray.endian', 'DataView endianness', ['typedArrays.DataView'], function () {
    var dv = new DataView(new ArrayBuffer(4)); dv.setUint32(0, 0x01020304, true);
    return ok(dv.getUint8(0) === 0x04 && dv.getUint32(0, false) === 0x04030201, 'little/big coherent');
  });
  T('promise.order', 'Promise.all preserve l ordre', ['timing.Promise'], function (ctx) {
    return Promise.all([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]).then(function (r) {
      return ok(r.join(',') === '1,2,3', 'ordre = ' + r.join(','));
    });
  });
  T('async.ordering', 'Microtache avant macrotache', ['timing.Promise'], function () {
    var seq = [];
    return new Promise(function (resolve) {
      global.setTimeout(function () { seq.push('timeout'); resolve(ok(seq.join(',') === 'micro,timeout', 'ordre = ' + seq.join(','))); }, 0);
      Promise.resolve().then(function () { seq.push('micro'); });
    });
  });
  T('try.finally.override', 'finally remplace la valeur de retour', [], function () {
    function f() { try { return 1; } finally { return 2; } }
    return ok(f() === 2, 'retour = ' + f());
  });
  T('closure.let', 'Portee de bloc (let dans boucle)', [], function () {
    var fns = [];
    try { eval('for (let i=0;i<3;i++){ fns.push(function(){return i;}); }'); }
    catch (e) { return { status: 'skip', detail: 'let non supporte' }; }
    return ok(fns[0]() === 0 && fns[2]() === 2, 'captures = ' + fns.map(function (f) { return f(); }).join(','));
  });

})(typeof window !== 'undefined' ? window : this);
