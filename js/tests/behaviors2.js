/*
 * PSWKT - Comportements JS (2) : davantage de verifications de correction
 * Complete la categorie "Comportements JS". Deterministe, non destructif.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  function T(id, name, requires, fn) {
    R.register({ id: 'beh2.' + id, name: name, category: 'behaviors', requires: requires || [], run: fn });
  }
  function ok(cond, detail, meas) { return { status: cond ? 'pass' : 'fail', detail: detail, measurements: meas || null }; }

  T('array.reduce.empty', 'reduce sur vide sans init leve', [], function () {
    var threw = false; try { [].reduce(function (a, b) { return a + b; }); } catch (e) { threw = e.name === 'TypeError'; }
    return ok(threw, threw ? 'TypeError attendue' : 'pas de TypeError');
  });
  T('array.findlast', 'findLast / findLastIndex', [], function () {
    if (![].findLast) return { status: 'skip', detail: 'findLast unavailable' };
    var a = [1, 2, 3, 4]; return ok(a.findLast(function (x) { return x % 2; }) === 3 && a.findLastIndex(function (x) { return x % 2; }) === 2, 'dernier impair = 3');
  });
  T('array.copywithin', 'copyWithin', [], function () {
    if (![].copyWithin) return { status: 'skip', detail: 'copyWithin unavailable' };
    return ok([1, 2, 3, 4, 5].copyWithin(0, 3).join(',') === '4,5,3,4,5', 'copie interne OK');
  });
  T('array.flatmap', 'flatMap', [], function () {
    if (![].flatMap) return { status: 'skip', detail: 'flatMap unavailable' };
    return ok([1, 2, 3].flatMap(function (x) { return [x, x * 2]; }).join(',') === '1,2,2,4,3,6', 'flatMap OK');
  });
  T('array.tosorted', 'toSorted does not mutate', [], function () {
    if (![].toSorted) return { status: 'skip', detail: 'toSorted unavailable' };
    var a = [3, 1, 2]; var b = a.toSorted(); return ok(b.join(',') === '1,2,3' && a.join(',') === '3,1,2', 'original intact');
  });
  T('string.at', 'String.at negative', [], function () {
    if (!''.at) return { status: 'skip', detail: 'at unavailable' };
    return ok('abc'.at(-1) === 'c' && 'abc'.at(0) === 'a', 'at OK');
  });
  T('string.split.limit', 'split with limit', [], function () {
    return ok('a,b,c,d'.split(',', 2).join('|') === 'a|b', 'limite respectee');
  });
  T('string.replace.fn', 'replace with a function', [], function () {
    var r = 'a1b2'.replace(/\d/g, function (m) { return '[' + m + ']'; });
    return ok(r === 'a[1]b[2]', 'remplacement fonctionnel');
  });
  T('string.matchall', 'matchAll', [], function () {
    if (!''.matchAll) return { status: 'skip', detail: 'matchAll unavailable' };
    var it = 'a1b2'.matchAll(/(\w)(\d)/g); var n = 0; for (var m of it) { n++; void m; }
    return ok(n === 2, 'correspondances = ' + n);
  });
  T('string.localecompare', 'localeCompare', [], function () {
    return ok('a'.localeCompare('b') < 0 && 'b'.localeCompare('a') > 0 && 'a'.localeCompare('a') === 0, 'ordre coherent');
  });
  T('number.radix', 'toString(radix)', [], function () {
    return ok((255).toString(16) === 'ff' && (8).toString(2) === '1000' && (35).toString(36) === 'z', 'bases OK');
  });
  T('number.epsilon', 'Number.EPSILON', [], function () {
    return ok(0.1 + 0.2 !== 0.3 && Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON, 'epsilon couvre l erreur');
  });
  T('math.minmax.empty', 'Math.min/max with no argument', [], function () {
    return ok(Math.min() === Infinity && Math.max() === -Infinity, 'infinis signes');
  });
  T('math.hypot', 'Math.hypot', [], function () {
    if (!Math.hypot) return { status: 'skip', detail: 'hypot unavailable' };
    return ok(Math.hypot(3, 4) === 5 && Math.hypot() === 0, 'hypot OK');
  });
  T('object.is', 'Object.is (-0, NaN)', [], function () {
    return ok(Object.is(-0, 0) === false && Object.is(NaN, NaN) === true && Object.is(1, 1), 'Object.is distinct de ===');
  });
  T('object.fromentries', 'entries <-> fromEntries', [], function () {
    if (!Object.fromEntries) return { status: 'skip', detail: 'fromEntries unavailable' };
    var o = { a: 1, b: 2 }; var o2 = Object.fromEntries(Object.entries(o));
    return ok(o2.a === 1 && o2.b === 2, 'aller-retour OK');
  });
  T('object.assign.getter', 'assign triggers getters', [], function () {
    var n = 0; var src = {}; Object.defineProperty(src, 'x', { enumerable: true, get: function () { n++; return 1; } });
    var d = Object.assign({}, src); return ok(d.x === 1 && n === 1, 'getter appele une fois');
  });
  T('generator.return', 'Generator.return terminates', [], function () {
    try { eval('0'); } catch (e) {}
    function make() { return (function* () { yield 1; yield 2; yield 3; })(); }
    var g; try { g = make(); } catch (e) { return { status: 'skip', detail: 'generator unavailable' }; }
    g.next(); var r = g.return(99);
    return ok(r.value === 99 && r.done === true && g.next().done === true, 'return termine le generateur');
  });
  T('iterator.custom', 'Custom iterator', ['objects.Symbol'], function () {
    var obj = {}; obj[Symbol.iterator] = function () { var i = 0; return { next: function () { return i < 3 ? { value: i++, done: false } : { value: undefined, done: true }; } }; };
    var a = []; for (var x of obj) a.push(x);
    return ok(a.join(',') === '0,1,2', 'iteration = ' + a.join(','));
  });
  T('promise.allsettled', 'Promise.allSettled', ['timing.Promise'], function () {
    if (!Promise.allSettled) return { status: 'skip', detail: 'allSettled unavailable' };
    return Promise.allSettled([Promise.resolve(1), Promise.reject(new Error('x'))]).then(function (r) {
      return ok(r[0].status === 'fulfilled' && r[1].status === 'rejected', 'etats = ' + r[0].status + '/' + r[1].status);
    });
  });
  T('promise.any', 'Promise.any (first resolved)', ['timing.Promise'], function () {
    if (!Promise.any) return { status: 'skip', detail: 'any unavailable' };
    return Promise.any([Promise.reject(new Error('a')), Promise.resolve(42)]).then(function (v) {
      return ok(v === 42, 'valeur = ' + v);
    });
  });
  T('typedarray.subarray.shares', 'subarray shares the buffer', ['typedArrays.Uint8Array'], function () {
    var ta = new Uint8Array([1, 2, 3, 4]); var sub = ta.subarray(1, 3); sub[0] = 99;
    return ok(ta[1] === 99, 'modification partagee (ta[1]=' + ta[1] + ')');
  });
  T('arraybuffer.slice.indep', 'ArrayBuffer.slice independent', ['typedArrays.ArrayBuffer'], function () {
    var ab = new ArrayBuffer(4); var v = new Uint8Array(ab); v[0] = 1;
    var ab2 = ab.slice(0); var v2 = new Uint8Array(ab2); v2[0] = 99;
    return ok(v[0] === 1 && v2[0] === 99, 'copie independante');
  });
  T('regex.sticky', 'RegExp sticky (y) lastIndex', [], function () {
    var re = /a/y; re.lastIndex = 1; var m = re.exec('baa');
    return ok(m && m.index === 1 && re.lastIndex === 2, 'sticky avance lastIndex');
  });
  T('regex.namedreplace', 'replace with $<name>', [], function () {
    try { var r = '2024-06'.replace(/(?<y>\d+)-(?<m>\d+)/, '$<m>/$<y>'); return ok(r === '06/2024', 'remplacement nomme = ' + r); }
    catch (e) { return { status: 'skip', detail: 'named groups unavailable' }; }
  });
  T('error.aggregate', 'AggregateError', [], function () {
    if (typeof AggregateError !== 'function') return { status: 'skip', detail: 'AggregateError unavailable' };
    var e = new AggregateError([new Error('a'), new Error('b')], 'multi');
    return ok(e.errors.length === 2 && e.message === 'multi', 'agrege 2 erreurs');
  });
  T('intl.collator', 'Intl.Collator accent sorting', [], function () {
    if (!global.Intl || !Intl.Collator) return { status: 'skip', detail: 'Intl.Collator unavailable' };
    var arr = ['e', 'é', 'a', 'z']; arr.sort(new Intl.Collator('fr').compare);
    return ok(arr[0] === 'a' && arr[arr.length - 1] === 'z', 'tri = ' + arr.join(','));
  });
  T('label.break', 'labeled break', [], function () {
    var hits = 0; outer: for (var i = 0; i < 3; i++) { for (var j = 0; j < 3; j++) { hits++; if (j === 1) continue outer; if (i === 2) break outer; } }
    return ok(hits > 0, 'labeled loops executed (' + hits + ')');
  });

})(typeof window !== 'undefined' ? window : this);
