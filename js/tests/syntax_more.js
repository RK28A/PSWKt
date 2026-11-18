/*
 * PSWKT - Sondes massives : syntaxe ECMAScript supplementaire
 * Complete la categorie Syntaxe. Chaque extrait est evalue : SyntaxError => non
 * supporte. Extraits courts, sans effet de bord, sans reseau, sans boucle.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.factory;

  var CASES = [
    ['optional catch', 'try{}catch{} true;'],
    ['numeric separators', 'var a=1_000; a;'],
    ['BigInt literal', 'var a=10n; a;'],
    ['exponentiation', 'var a=2**10; a;'],
    ['assignment **=', 'var a=2; a**=3; a;'],
    ['assignment ??=', 'var a=null; a??=2; a;'],
    ['assignment ||=', 'var a=0; a||=2; a;'],
    ['assignment &&=', 'var a=1; a&&=2; a;'],
    ['optional chaining', 'var o={}; o?.a?.b; true;'],
    ['optional call', 'var o={f:function(){return 1;}}; o.f?.();'],
    ['nullish coalescing', 'var a=null??1; a;'],
    ['class fields', 'class C{a=1;} new C().a;'],
    ['private field', 'class C{#x=1; g(){return this.#x;}} new C().g();'],
    ['private method', 'class C{#m(){return 1;} r(){return this.#m();}} new C().r();'],
    ['private accessor', 'class C{#x=1; get v(){return this.#x;}} new C().v;'],
    ['static field', 'class C{static x=1;} C.x;'],
    ['static block', 'class C{static{this.y=1;}} C.y;'],
    ['#x in obj (branded check)', 'class C{#x=1; static has(o){return #x in o;}} C.has(new C());'],
    ['async/await', 'async function f(){return await 1;} typeof f;'],
    ['async arrow', 'var f=async()=>await 1; typeof f;'],
    ['generator', 'function* g(){yield 1;} g().next().value;'],
    ['async generator', 'async function* g(){yield 1;} typeof g;'],
    ['for-await-of', 'async function f(){for await(const x of []){void x;}} typeof f;'],
    ['computed property', 'var k="x"; var o={[k]:1}; o.x;'],
    ['shorthand method', 'var o={m(){return 1;}}; o.m();'],
    ['object accessor', 'var o={get x(){return 1;}}; o.x;'],
    ['spread in call', 'Math.max(...[1,2,3]);'],
    ['tagged template', 'function t(s){return s[0];} t`hi`;'],
    ['String.raw', 'String.raw`a\\nb`.length;'],
    ['trailing comma in params', 'function f(a,){return a;} f(1,);'],
    ['default param + rest', 'function f(a=1,...b){return a+b.length;} f();'],
    ['destructuring default', 'var [a=5]=[]; a;'],
    ['regex named groups', 'var m="a".match(/(?<x>a)/); m.groups.x;'],
    ['regex lookbehind', '/(?<=a)b/.test("ab");'],
    ['regex dotAll (s)', '/./s.test("\\n");'],
    ['regex unicode property', '/\\p{L}/u.test("a");'],
    ['regex indices (d)', 'var m=/a/d.exec("a"); !!m.indices;'],
    ['regex v flag', '/[\\p{L}]/v.test("a");'],
    ['Array.at negatif', '[1,2,3].at(-1);'],
    ['Object.hasOwn', 'Object.hasOwn({a:1},"a");'],
    ['Error cause', 'new Error("x",{cause:1}).cause;'],
    ['using declaration', 'function f(){using x=null; return 1;} f();'],
    ['logic with chaining', 'var o=null; (o?.a) ?? 1;']
  ];

  // Prefixe unique par index : idSafe() retire les symboles, donc 'affectation **='
  // et 'affectation ??=' donneraient le meme id. L'index garantit l'unicite.
  for (var i = 0; i < CASES.length; i++) F.syntax('syntax', 'synx' + i, CASES[i][0], CASES[i][1], CASES[i][0]);

})(typeof window !== 'undefined' ? window : this);
