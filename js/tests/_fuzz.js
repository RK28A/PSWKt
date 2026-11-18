/*
 * PSWKT - Infrastructure de FUZZING (entrees malformees / adversariales)
 * -----------------------------------------------------------------------
 * But : pousser les API JavaScript/WebKit a leurs limites avec des entrees
 * MAL FORMEES, degenerees ou piegees, puis DOCUMENTER comment le moteur
 * reagit. Entierement NON DESTRUCTIF :
 *   - chaque appel est encadre par try/catch (rien ne remonte en erreur globale) ;
 *   - toutes les tailles sont BORNEES (pas d'allocation sans fin, ctx.charge) ;
 *   - chaque boucle appelle ctx.tick() -> respect de l'echeance et du bouton Stop ;
 *   - le generateur d'aleatoire est SEME (reproductible d'une execution a l'autre).
 *
 * Deux fabriques :
 *   fuzz.resilience(opts) : envoie un corpus d'entrees a une fonction cible et
 *     verifie que le moteur reste coherent (il RENVOIE ou LEVE une erreur
 *     rattrapable, jamais un plantage silencieux). Un `invariant` optionnel
 *     transforme une sortie incoherente en ECHEC documente.
 *   fuzz.invariant(opts) : fuzz par propriete/aller-retour (round-trip,
 *     idempotence...). ECHEC si la propriete est violee -> vrai detecteur de bug.
 *
 * Convention de statut :
 *   pass  = le moteur a survecu / la propriete tient (comportement a documenter) ;
 *   fail  = invariant viole (anomalie a consigner) ;
 *   error/aborted = gere par le harnais (echeance, Stop) et documente.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  // --- PRNG seme (mulberry32) : reproductible, rapide, sans dependance ---
  function rngFrom(seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Hash de chaine -> entier, pour deriver un seed stable depuis l'id du test.
  function hashSeed(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function pick(rng, arr) { return arr[randInt(rng, arr.length)]; }

  // --- Repetition bornee, avec comptabilisation memoire ---
  function repeatSafe(ctx, s, n, capBytes) {
    capBytes = capBytes || 262144; // 256 Ko plafond par defaut
    var unit = s.length * 2; // approx UTF-16
    var maxN = unit > 0 ? Math.floor(capBytes / unit) : n;
    if (n > maxN) n = maxN;
    if (n < 0) n = 0;
    if (ctx && ctx.charge) ctx.charge(n * unit);
    var out = '';
    try { out = (typeof s.repeat === 'function') ? s.repeat(n) : new Array(n + 1).join(s); }
    catch (e) { out = ''; }
    return out;
  }

  // --- Corpus de chaines malformees / adversariales (non destructif, borne) ---
  function nastyStrings(ctx) {
    var S = [];
    function add(v, label) { S.push({ v: v, label: label }); }
    add('', 'vide');
    add(' ', 'espace');
    add('\t\n\r\f\v', 'blancs mixtes');
    add('\u0000', 'NUL');
    add('\u0000abc\u0000', 'NUL encadrant');
    add('\u0001\u0002\u001F\u007F', 'controles C0/DEL');
    add('￿', 'U+FFFF');
    add('￾', 'U+FFFE (BOM inverse)');
    add('﻿', 'BOM/zero-width no-break');
    add('​‌‍', 'zero-width (ZWSP/ZWNJ/ZWJ)');
    add('\uD800', 'surrogate haute isolee');
    add('\uDC00', 'surrogate basse isolee');
    add('\uD800\uD800', 'deux surrogates hautes');
    add('\uDC00\uD800', 'paire inversee');
    add('a\uD800b', 'surrogate isolee au milieu');
    add('􏿿', 'U+10FFFF (paire valide extreme)');
    add('é', 'e + accent combinant');
    add('à́̂̃̄', 'base + 5 combinants');
    add('ೆೆೆೆೆ', 'combinants empiles (Kannada)');
    add('‮abc', 'RLO (bidi override)');
    add('abc‮def‬', 'bidi override + pop');
    add('٠١٢٣٤', 'chiffres arabes-indiens');
    add('١٢', 'chiffres arabes');
    add('½¼¾⅞', 'fractions');
    add('ⅫⅬ', 'chiffres romains unicode');
    add('%s%d%n%x%p', 'format-string style C');
    add('{{7*7}}', 'template injection style');
    add('${alert(1)}', 'template literal style');
    add('\\x41\\u0041\\101', 'echappements litteraux');
    add('"', 'guillemet seul');
    add("'", 'apostrophe seule');
    add('\\', 'antislash seul');
    add('\\\\\\', 'antislashs');
    add('{', 'accolade ouvrante');
    add('[', 'crochet ouvrant');
    add('</script><script>', 'balises (donnee inerte)');
    add("'; DROP TABLE--", 'motif SQL (donnee inerte)');
    add('../../../etc/passwd', 'traversee (donnee inerte)');
    add('  12.5  ', 'nombre entoure d espaces');
    add('0x1F', 'hex style');
    add('1_000_000', 'separateurs numeriques');
    add('1,000.5', 'milliers a virgule');
    add('1e1000', 'exposant demesure');
    add('NaNInfinity', 'mots-cles colles');
    add(repeatSafe(ctx, 'A', 50000, 131072), 'A x 50000 (borne)');
    add(repeatSafe(ctx, '😀', 8000, 131072), 'emoji repete (borne)');
    add(repeatSafe(ctx, '\uD800', 10000, 131072), 'surrogates isolees x N (borne)');
    add(repeatSafe(ctx, 'é', 8000, 131072), 'combinant repete (borne)');
    return S;
  }

  // --- Corpus de nombres limites / degeneres ---
  function nastyNumbers() {
    var vals = [
      0, -0, 1, -1, 0.5, -0.5,
      NaN, Infinity, -Infinity,
      Number.MAX_VALUE, Number.MIN_VALUE, 5e-324,
      Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 2, -Number.MAX_SAFE_INTEGER,
      9007199254740992, 9007199254740993,
      1e308, 1e-308, 0.1 + 0.2,
      2147483647, 2147483648, -2147483648, 4294967295, 4294967296,
      Math.PI, 1 / 3, 1.7976931348623157e308
    ];
    var out = [];
    for (var i = 0; i < vals.length; i++) out.push({ v: vals[i], label: String(vals[i]) });
    return out;
  }

  // --- Objets-pieges : coercition qui ment, qui leve, ou qui mute ---
  var _hasSymPrim = (typeof global.Symbol === 'function' && global.Symbol.toPrimitive);
  function trap(kind) {
    var o;
    if (kind === 'throwValueOf') {
      return { valueOf: function () { throw new Error('piege valueOf'); }, label: 'valueOf leve' };
    }
    if (kind === 'throwToString') {
      return { toString: function () { throw new Error('piege toString'); },
               valueOf: function () { return {}; }, label: 'toString leve' };
    }
    if (kind === 'throwSymPrim' && _hasSymPrim) {
      o = {}; o[global.Symbol.toPrimitive] = function () { throw new Error('piege @@toPrimitive'); };
      o.label = '@@toPrimitive leve'; return o;
    }
    if (kind === 'lying') {
      var n = 0;
      return { valueOf: function () { return (n++ % 2) ? 1 : 1000000; },
               toString: function () { return 'muta-' + n; }, label: 'valueOf changeant' };
    }
    if (kind === 'poisonLength') {
      return { length: { valueOf: function () { throw new Error('piege length'); } }, 0: 'x', label: 'length.valueOf leve' };
    }
    if (kind === 'negLength') { return { length: -1, 0: 'x', label: 'length = -1' }; }
    if (kind === 'hugeLength') { return { length: 4294967296, label: 'length = 2^32' }; }
    if (kind === 'floatLength') { return { length: 2.7, 0: 'a', 1: 'b', label: 'length = 2.7' }; }
    if (kind === 'getterThrows') {
      o = {};
      try { Object.defineProperty(o, 'x', { get: function () { throw new Error('getter leve'); }, enumerable: true }); } catch (e) {}
      o.label = 'getter leve'; return o;
    }
    return { label: 'objet nu' };
  }
  function trapObjects() {
    var kinds = ['throwValueOf', 'throwToString', 'throwSymPrim', 'lying',
                 'poisonLength', 'negLength', 'hugeLength', 'floatLength', 'getterThrows'];
    var out = [];
    for (var i = 0; i < kinds.length; i++) {
      var o = trap(kinds[i]);
      if (o) out.push({ v: o, label: o.label || kinds[i] });
    }
    return out;
  }

  // --- Valeurs heterogenes a passer la ou un type precis est attendu ---
  function nastyValues(ctx) {
    var cyc = {}; cyc.self = cyc;
    var sparse = []; sparse[1000] = 'loin'; // tableau a trous
    var out = [
      { v: null, label: 'null' },
      { v: undefined, label: 'undefined' },
      { v: NaN, label: 'NaN' },
      { v: true, label: 'true' },
      { v: false, label: 'false' },
      { v: 0, label: '0' },
      { v: '', label: 'chaine vide' },
      { v: {}, label: 'objet vide' },
      { v: [], label: 'tableau vide' },
      { v: [1, 2, 3], label: 'tableau [1,2,3]' },
      { v: sparse, label: 'tableau a trous (len 1001)' },
      { v: function () {}, label: 'fonction' },
      { v: /re/g, label: 'RegExp' },
      { v: new Date('invalide'), label: 'Date invalide' },
      { v: cyc, label: 'objet cyclique' }
    ];
    if (typeof global.Symbol === 'function') out.push({ v: global.Symbol('s'), label: 'Symbol' });
    if (typeof global.BigInt === 'function') { try { out.push({ v: global.BigInt(42), label: 'BigInt' }); } catch (e) {} }
    var traps = trapObjects();
    for (var i = 0; i < traps.length; i++) out.push(traps[i]);
    return out;
  }

  // --- Mutateur : derive des variantes MALFORMEES d'une graine valide ---
  var MUT_CHARS = '{}[]":,\\\'`<>/ \t\n\u0000\uD800￿abcABC0129.-+eEnulfas';
  function mutate(rng, s) {
    var a = String(s).split('');
    var ops = 1 + randInt(rng, 4);
    for (var k = 0; k < ops; k++) {
      if (a.length === 0) { a.push(pick(rng, MUT_CHARS.split(''))); continue; }
      var mode = randInt(rng, 7);
      var i = randInt(rng, a.length);
      if (mode === 0) a.splice(i, 1);                                  // suppression
      else if (mode === 1) a.splice(i, 0, pick(rng, MUT_CHARS.split(''))); // insertion
      else if (mode === 2) a[i] = pick(rng, MUT_CHARS.split(''));      // substitution
      else if (mode === 3) a[i] = String.fromCharCode(a[i].charCodeAt(0) ^ (1 << randInt(rng, 8))); // bit-flip
      else if (mode === 4) a.splice(i, 0, a[i]);                       // duplication
      else if (mode === 5) a = a.slice(0, i);                          // troncature
      else a[i] = a[i].toUpperCase() === a[i] ? a[i].toLowerCase() : a[i].toUpperCase(); // casse
    }
    return a.join('');
  }
  // Produit `count` entrees : la graine + des mutations reproductibles.
  function mutationInputs(ctx, seedStr, count, rngSeed) {
    var rng = rngFrom(rngSeed || hashSeed(seedStr));
    var out = [{ v: seedStr, label: 'graine' }];
    for (var i = 0; i < count; i++) {
      if (ctx && ctx.tick) ctx.tick();
      var m = mutate(rng, seedStr);
      out.push({ v: m, label: 'mut#' + i + ' ' + previewOf(m) });
    }
    return out;
  }

  // --- Apercu court et sur d'une valeur quelconque (pour le journal) ---
  function previewOf(v) {
    var s;
    try {
      if (typeof v === 'string') s = JSON.stringify(v.length > 24 ? v.slice(0, 24) + '…' : v);
      else if (v && v.label) s = '<' + v.label + '>';
      else s = Object.prototype.toString.call(v);
    } catch (e) { s = '[?]'; }
    if (s == null) s = String(v);
    if (s.length > 40) s = s.slice(0, 40) + '…';
    return s;
  }

  // --- Classe l'issue d'un appel synchrone : RENVOIE vs LEVE ---
  function classify(thunk) {
    var t0 = PSWKT.now();
    try {
      var v = thunk();
      return { kind: 'returned', ms: PSWKT.now() - t0, value: v };
    } catch (e) {
      return { kind: 'threw', ms: PSWKT.now() - t0,
               name: (e && e.name) || 'Error',
               message: (e && e.message) ? String(e.message) : String(e) };
    }
  }

  /*
   * fuzz.resilience(opts)
   * opts : {
   *   id, name, category, description, requires?, quiet?,
   *   build(ctx) -> { target: function(value, input), inputs: [{v,label}, ...] },
   *   invariant?(input, outcome) -> true | 'raison'   // optionnel : fail si faux
   * }
   * Envoie chaque entree a `target`, encadre par try/catch, et compte
   * renvoi/leve + repartition des types d'erreur. Le moteur a survecu => pass.
   */
  function resilience(opts) {
    R.register({
      id: opts.id, name: opts.name, category: opts.category,
      description: opts.description, requires: opts.requires || [],
      quiet: opts.quiet,
      run: function (ctx) {
        var built = opts.build(ctx) || {};
        var target = built.target, inputs = built.inputs || [];
        var returned = 0, threw = 0, maxMs = 0, slow = null;
        var byError = {}, samples = [], violations = [];
        var step = Math.max(1, Math.floor(inputs.length / 6));
        for (var i = 0; i < inputs.length; i++) {
          ctx.tick();
          var inp = inputs[i];
          var oc = classify((function (x, meta) { return function () { return target(x, meta); }; })(inp.v, inp));
          if (oc.kind === 'returned') returned++;
          else { threw++; byError[oc.name] = (byError[oc.name] || 0) + 1; }
          if (oc.ms > maxMs) { maxMs = oc.ms; slow = inp.label; }
          if (opts.invariant) {
            var ok = true, why = '';
            try { var r = opts.invariant(inp, oc); if (r !== true) { ok = false; why = (typeof r === 'string') ? r : 'invariant faux'; } }
            catch (e) { ok = false; why = 'invariant a leve : ' + (e && e.message); }
            if (!ok && violations.length < 8) violations.push({ input: inp.label, issue: why, outcome: oc.kind, err: oc.name || null });
          }
          if (samples.length < 6 && (i % step) === 0)
            samples.push({ input: inp.label, outcome: oc.kind, err: oc.name || null });
        }
        var status = violations.length ? 'fail' : 'pass';
        var detail = inputs.length + ' entrees : ' + returned + ' renvois, ' + threw + ' erreurs rattrapees' +
          (violations.length ? (' ; ' + violations.length + ' INVARIANT(S) VIOLE(S)') : ' ; aucun plantage') +
          ' ; max ' + (Math.round(maxMs * 1000) / 1000) + ' ms';
        ctx.info(detail);
        return {
          status: status, detail: detail,
          measurements: {
            count: inputs.length, returned: returned, threw: threw,
            errorTypes: byError, maxCallMs: Math.round(maxMs * 1000) / 1000, slowest: slow,
            samples: samples, violations: violations
          }
        };
      }
    });
  }

  /*
   * fuzz.invariant(opts)
   * opts : {
   *   id, name, category, description, requires?, quiet?,
   *   build(ctx) -> { inputs: [{v,label}, ...] },
   *   check(value, input) -> true | 'raison'   // peut lever (compte comme raison)
   * }
   * Verifie une propriete (aller-retour, idempotence...) sur chaque entree.
   * ECHEC si une entree viole la propriete.
   */
  function invariant(opts) {
    R.register({
      id: opts.id, name: opts.name, category: opts.category,
      description: opts.description, requires: opts.requires || [],
      quiet: opts.quiet,
      run: function (ctx) {
        var built = opts.build(ctx) || {};
        var inputs = built.inputs || [];
        var held = 0, broke = 0, violations = [];
        for (var i = 0; i < inputs.length; i++) {
          ctx.tick();
          var inp = inputs[i];
          var res;
          try { res = opts.check(inp.v, inp); }
          catch (e) { res = 'verif a leve : ' + ((e && e.name) || '') + ' ' + ((e && e.message) || e); }
          if (res === true) held++;
          else { broke++; if (violations.length < 12) violations.push({ input: inp.label, reason: String(res) }); }
        }
        var status = broke ? 'fail' : 'pass';
        var detail = inputs.length + ' entrees : ' + held + ' conforme(s), ' + broke + ' violation(s)';
        ctx.info(detail);
        return {
          status: status, detail: detail,
          measurements: { count: inputs.length, held: held, broke: broke, violations: violations }
        };
      }
    });
  }

  PSWKT.fuzz = {
    rngFrom: rngFrom, hashSeed: hashSeed, randInt: randInt, pick: pick,
    repeatSafe: repeatSafe,
    nastyStrings: nastyStrings, nastyNumbers: nastyNumbers,
    nastyValues: nastyValues, trapObjects: trapObjects, trap: trap,
    mutate: mutate, mutationInputs: mutationInputs,
    previewOf: previewOf, classify: classify,
    resilience: resilience, invariant: invariant
  };

})(typeof window !== 'undefined' ? window : this);
