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
    ['catch optionnel', 'try{}catch{} true;'],
    ['separateurs numeriques', 'var a=1_000; a;'],
    ['litteral BigInt', 'var a=10n; a;'],
    ['exponentiation', 'var a=2**10; a;'],
    ['affectation **=', 'var a=2; a**=3; a;'],
    ['affectation ??=', 'var a=null; a??=2; a;'],
    ['affectation ||=', 'var a=0; a||=2; a;'],
    ['affectation &&=', 'var a=1; a&&=2; a;'],
    ['chainage optionnel', 'var o={}; o?.a?.b; true;'],
    ['appel optionnel', 'var o={f:function(){return 1;}}; o.f?.();'],
    ['coalescence nulle', 'var a=null??1; a;'],
    ['champs de classe', 'class C{a=1;} new C().a;'],
    ['champ prive', 'class C{#x=1; g(){return this.#x;}} new C().g();'],
    ['methode privee', 'class C{#m(){return 1;} r(){return this.#m();}} new C().r();'],
    ['accesseur prive', 'class C{#x=1; get v(){return this.#x;}} new C().v;'],
    ['champ statique', 'class C{static x=1;} C.x;'],
    ['bloc statique', 'class C{static{this.y=1;}} C.y;'],
    ['#x in obj (verif branded)', 'class C{#x=1; static has(o){return #x in o;}} C.has(new C());'],
    ['async/await', 'async function f(){return await 1;} typeof f;'],
    ['fleche async', 'var f=async()=>await 1; typeof f;'],
    ['generateur', 'function* g(){yield 1;} g().next().value;'],
    ['generateur async', 'async function* g(){yield 1;} typeof g;'],
    ['for-await-of', 'async function f(){for await(const x of []){void x;}} typeof f;'],
    ['propriete calculee', 'var k="x"; var o={[k]:1}; o.x;'],
    ['methode abregee', 'var o={m(){return 1;}}; o.m();'],
    ['accesseur objet', 'var o={get x(){return 1;}}; o.x;'],
    ['spread dans appel', 'Math.max(...[1,2,3]);'],
    ['gabarit balise', 'function t(s){return s[0];} t`hi`;'],
    ['String.raw', 'String.raw`a\\nb`.length;'],
    ['virgule finale parametres', 'function f(a,){return a;} f(1,);'],
    ['parametre defaut+rest', 'function f(a=1,...b){return a+b.length;} f();'],
    ['destructuration defaut', 'var [a=5]=[]; a;'],
    ['regex groupes nommes', 'var m="a".match(/(?<x>a)/); m.groups.x;'],
    ['regex lookbehind', '/(?<=a)b/.test("ab");'],
    ['regex dotAll (s)', '/./s.test("\\n");'],
    ['regex propriete unicode', '/\\p{L}/u.test("a");'],
    ['regex indices (d)', 'var m=/a/d.exec("a"); !!m.indices;'],
    ['regex drapeau v', '/[\\p{L}]/v.test("a");'],
    ['Array.at negatif', '[1,2,3].at(-1);'],
    ['Object.hasOwn', 'Object.hasOwn({a:1},"a");'],
    ['Error cause', 'new Error("x",{cause:1}).cause;'],
    ['declaration using', 'function f(){using x=null; return 1;} f();'],
    ['logique avec chainage', 'var o=null; (o?.a) ?? 1;']
  ];

  // Prefixe unique par index : idSafe() retire les symboles, donc 'affectation **='
  // et 'affectation ??=' donneraient le meme id. L'index garantit l'unicite.
  for (var i = 0; i < CASES.length; i++) F.syntax('syntax', 'synx' + i, CASES[i][0], CASES[i][1], CASES[i][0]);

})(typeof window !== 'undefined' ? window : this);
