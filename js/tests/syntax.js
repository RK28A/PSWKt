/*
 * PSWKT - Sondes : syntaxe ECMAScript
 * Technique : eval d'un extrait auto-contenu. Un SyntaxError => non supporte.
 * Non destructif (eval strict, sans effet de bord ni fuite de variable).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('syntax', 'Syntaxe ECMAScript', 'Support des constructions du langage (ES2015 -> recent).');

  // [nom, code]
  var CASES = [
    ['let / const', 'let a=1; const b=2; a+b;'],
    ['fonction flechee', 'var f=(x)=>x*2; f(3);'],
    ['literal de gabarit', 'var n=3; `v=${n}`;'],
    ['parametres par defaut', 'function f(a=1){return a;} f();'],
    ['parametre rest', 'function f(...a){return a.length;} f(1,2);'],
    ['spread tableau', 'var a=[1,2]; var b=[...a,3]; b.length;'],
    ['spread objet', 'var o={a:1}; var p={...o,b:2}; p.b;'],
    ['destructuration tableau', 'var [a,b]=[1,2]; a+b;'],
    ['destructuration objet', 'var {x,y}={x:1,y:2}; x+y;'],
    ['destructuration imbriquee', 'var {a:{b}}={a:{b:5}}; b;'],
    ['classe', 'class C{constructor(){this.v=1;}} new C().v;'],
    ['heritage de classe', 'class A{};class B extends A{}; new B() instanceof A;'],
    ['champs de classe', 'class C{x=1;} new C().x;'],
    ['champ prive', 'class C{#x=1; get(){return this.#x;}} new C().get();'],
    ['methode statique', 'class C{static m(){return 1;}} C.m();'],
    ['bloc statique', 'class C{static x; static{ C.x=1; }} C.x;'],
    ['getter / setter', 'var o={get v(){return 1;}}; o.v;'],
    ['proprietes calculees', 'var k="a"; var o={[k]:1}; o.a;'],
    ['raccourci de propriete', 'var a=1; var o={a}; o.a;'],
    ['for...of', 'var s=0; for(var x of [1,2,3]) s+=x; s;'],
    ['for...in', 'var s=""; for(var k in {a:1}) s+=k; s;'],
    ['generateur', 'function* g(){yield 1;} g().next().value;'],
    ['generateur async', 'async function* g(){yield 1;} typeof g;'],
    ['async / await', 'async function f(){return await 1;} typeof f;'],
    ['exponentiation **', '2 ** 10;'],
    ['chainage optionnel ?.', 'var o=null; o?.x;'],
    ['appel optionnel ?.()', 'var o={}; o.f?.();'],
    ['acces optionnel ?.[]', 'var o=null; o?.[0];'],
    ['coalescence ??', 'null ?? 5;'],
    ['affectation nullish ??=', 'var o={}; o.x ??= 1; o.x;'],
    ['affectation ou ||=', 'var a=0; a ||= 2; a;'],
    ['affectation et &&=', 'var a=1; a &&= 3; a;'],
    ['separateur numerique', '1_000_000;'],
    ['litteral BigInt', 'typeof 10n;'],
    ['litteral binaire', '0b1010;'],
    ['litteral octal', '0o17;'],
    ['virgule finale args', 'function f(a,){return a;} f(1,);'],
    ['catch sans binding', 'try{throw 1;}catch{}; true;'],
    ['Array.at negatif', '[1,2,3].at(-1);'],
    ['Object.hasOwn', 'Object.hasOwn({a:1},"a");'],
    ['top-level numeric sep BigInt', '1_0n;'],
    ['import.meta (syntaxe)', 'typeof import;'],
    ['RegExp flag d', 'new RegExp("a","d").flags;'],
    ['RegExp flag v', 'new RegExp("a","v").flags;'],
    ['labeled block', 'bloc: { break bloc; } true;'],
    ['tagged template', 'function t(s){return s[0];} t`abc`;']
  ];

  for (var i = 0; i < CASES.length; i++) {
    F.syntax('syntax', 'syn', CASES[i][0], CASES[i][1]);
  }

})(typeof window !== 'undefined' ? window : this);
