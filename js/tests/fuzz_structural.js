/*
 * PSWKT - FUZZ : structures degenerees et pieges d execution
 * Imbrication profonde (bornee), cycles, Proxy a trappes hostiles, clonage,
 * et pieges d iteration. On documente la reaction du moteur (recursion limite,
 * detection de cycle, invariants de Proxy...). Non destructif : profondeurs et
 * tailles plafonnees, boucles instrumentees par ctx.tick().
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.fuzz;
  var R = PSWKT.runner;

  R.defineCategory('fuzz_structural', 'Fuzz · structures & pieges',
    'Imbrication profonde, cycles, Proxy hostiles, structuredClone, iterateurs piges (borne).');

  var CAT = 'fuzz_structural';

  // Construit un objet/tableau imbrique a la profondeur voulue (borne).
  function nest(depth, asArray) {
    var root = asArray ? [] : {};
    var cur = root;
    for (var i = 0; i < depth; i++) {
      var next = asArray ? [] : {};
      if (asArray) cur.push(next); else cur.child = next;
      cur = next;
    }
    return root;
  }

  // 1) JSON.stringify/parse sur imbrication profonde croissante : trouve le seuil de RangeError.
  F.resilience({
    id: 'fuzz.struct.deep.json', name: 'JSON · imbrication profonde', category: CAT,
    description: 'stringify/parse sur profondeurs croissantes : soit OK, soit RangeError (pile) rattrapee.',
    build: function (ctx) {
      var inputs = [];
      var depths = [10, 50, 100, 200, 500, 1000, 2000, 4000, 8000];
      for (var i = 0; i < depths.length; i++) inputs.push({ v: depths[i], label: 'profondeur ' + depths[i] });
      return {
        target: function (d) {
          var obj = nest(d, false);
          var s = JSON.stringify(obj);           // peut lever RangeError (pile) sur WebKit
          var back = JSON.parse(s);              // idem
          // profondeur reconstruite
          var n = 0, cur = back;
          while (cur && cur.child && n < d + 5) { cur = cur.child; n++; }
          return { depth: d, chars: s.length, rebuilt: n };
        },
        inputs: inputs
      };
    }
  });

  // 2) Recursion profonde directe : mesure la profondeur de pile avant RangeError (documente).
  F.resilience({
    id: 'fuzz.struct.recursion', name: 'Recursion · profondeur de pile', category: CAT,
    description: 'Recursion auto-limitee : capture le RangeError de depassement de pile et rapporte la profondeur.',
    build: function (ctx) {
      return {
        target: function () {
          var max = 0;
          function rec(n) { max = n; if (n > 1000000) return n; return rec(n + 1); } // plafond dur de securite
          try { rec(1); } catch (e) { return { depthReached: max, err: e.name }; }
          return { depthReached: max, err: null };
        },
        inputs: [{ v: null, label: 'recursion auto' }]
      };
    },
    invariant: function (inp, oc) {
      if (oc.kind !== 'returned') return 'la recursion a propage une erreur non geree (' + oc.name + ')';
      // On attend soit un RangeError (pile), soit l atteinte du plafond de securite.
      return true;
    }
  });

  // 3) structuredClone / JSON sur cycles : detection de cycle attendue (pas de boucle infinie).
  F.resilience({
    id: 'fuzz.struct.cycles', name: 'Cycles · clone & stringify', category: CAT,
    description: 'Structures cycliques variees : TypeError (cycle) rattrapee ou clone reussi, jamais de boucle infinie.',
    build: function (ctx) {
      function makeCycle(kind) {
        var a, b;
        if (kind === 'self') { a = {}; a.me = a; return a; }
        if (kind === 'mutual') { a = {}; b = {}; a.b = b; b.a = a; return a; }
        if (kind === 'arr') { a = []; a.push(a); return a; }
        if (kind === 'deep') { a = { x: { y: { z: {} } } }; a.x.y.z.back = a; return a; }
        if (kind === 'map' && typeof Map === 'function') { var m = new Map(); m.set('self', m); return m; }
        return {};
      }
      var kinds = ['self', 'mutual', 'arr', 'deep', 'map'];
      var inputs = [];
      for (var i = 0; i < kinds.length; i++) inputs.push({ v: makeCycle(kinds[i]), label: 'cycle ' + kinds[i] });
      return {
        target: function (o) {
          var r = {};
          try { JSON.stringify(o); r.json = 'ok (pas de cycle detecte!)'; } catch (e) { r.json = e.name; }
          if (typeof structuredClone === 'function') {
            try { structuredClone(o); r.clone = 'ok'; } catch (e) { r.clone = e.name; }
          } else r.clone = 'absent';
          return r;
        },
        inputs: inputs
      };
    },
    invariant: function (inp, oc) {
      if (oc.kind !== 'returned') return 'traitement du cycle a leve hors try interne (' + oc.name + ')';
      // JSON.stringify sur un cycle d OBJETS/TABLEAUX enumerables DOIT lever (TypeError).
      // Le cycle via une Map est legitime : Map n a pas de proprietes enumerables, donc
      // JSON.stringify(map) === "{}" sans parcourir le cycle -> ce n est PAS une anomalie.
      if (inp.label !== 'cycle map' && oc.value && typeof oc.value.json === 'string' && oc.value.json.indexOf('ok') === 0)
        return 'JSON.stringify n a PAS detecte le cycle (' + inp.label + ')';
      return true;
    }
  });

  // 4) Proxy a trappes hostiles : le moteur doit faire respecter les invariants (TypeError).
  F.resilience({
    id: 'fuzz.struct.proxy.hostile', name: 'Proxy · trappes hostiles', category: CAT,
    description: 'Trappes qui levent, mentent ou violent les invariants : le moteur impose TypeError, jamais de plantage.',
    requires: ['objects.Proxy'],
    build: function (ctx) {
      var inputs = [];
      function mk(kind) {
        if (kind === 'throwGet') return new Proxy({}, { get: function () { throw new Error('get leve'); } });
        if (kind === 'throwHas') return new Proxy({}, { has: function () { throw new Error('has leve'); } });
        if (kind === 'throwOwnKeys') return new Proxy({}, { ownKeys: function () { throw new Error('ownKeys leve'); } });
        if (kind === 'badOwnKeys') return new Proxy({}, { ownKeys: function () { return [1, 2, 3]; } }); // doit etre des chaines/symbols
        if (kind === 'lyingDescr') {
          var t = {}; Object.defineProperty(t, 'x', { value: 1, configurable: false, writable: false, enumerable: true });
          return new Proxy(t, { get: function () { return 999; } }); // ment sur une prop non-configurable/non-writable -> TypeError
        }
        if (kind === 'nonExtLie') {
          var o = Object.preventExtensions({ a: 1 });
          return new Proxy(o, { getOwnPropertyDescriptor: function () { return { configurable: true, value: 1 }; } });
        }
        if (kind === 'revoked' && typeof Proxy.revocable === 'function') {
          var rv = Proxy.revocable({}, {}); rv.revoke(); return rv.proxy;
        }
        return new Proxy({}, {});
      }
      var kinds = ['throwGet', 'throwHas', 'throwOwnKeys', 'badOwnKeys', 'lyingDescr', 'nonExtLie', 'revoked'];
      for (var i = 0; i < kinds.length; i++) {
        var p; try { p = mk(kinds[i]); } catch (e) { p = null; }
        if (p) inputs.push({ v: p, label: kinds[i] });
      }
      return {
        target: function (p) {
          var r = {};
          try { r.get = typeof p.x; } catch (e) { r.get = e.name; }
          try { r.has = ('x' in p); } catch (e) { r.has = e.name; }
          try { r.keys = Object.keys(p).length; } catch (e) { r.keys = e.name; }
          try { JSON.stringify(p); r.json = 'ok'; } catch (e) { r.json = e.name; }
          try { for (var k in p) { void k; break; } r.forin = 'ok'; } catch (e) { r.forin = e.name; }
          return r;
        },
        inputs: inputs
      };
    }
  });

  // 5) Iterateurs piges : Symbol.iterator qui leve/ment, passes a from/spread/Map/Set.
  F.resilience({
    id: 'fuzz.struct.iterator.hostile', name: 'Iterateurs hostiles', category: CAT,
    description: 'next()/Symbol.iterator qui levent ou renvoient des objets invalides : erreur rattrapee, jamais de boucle folle.',
    requires: ['objects.Symbol'],
    build: function (ctx) {
      function mk(kind) {
        var o = {};
        o.kind = kind; // marqueur (non iterable) pour desactiver les consommateurs non plafonnables
        o[Symbol.iterator] = function () {
          if (kind === 'throwIter') throw new Error('iterator leve');
          var i = 0;
          return {
            next: function () {
              if (kind === 'throwNext') throw new Error('next leve');
              if (kind === 'badReturn') return 42;                   // devrait etre un objet {value,done}
              if (kind === 'neverDone') return { value: i++, done: false }; // infini -> plafonne cote consommateur
              if (kind === 'nullReturn') return null;
              return { value: i, done: ++i > 3 };
            }
          };
        };
        return o;
      }
      var kinds = ['throwIter', 'throwNext', 'badReturn', 'neverDone', 'nullReturn', 'ok'];
      var inputs = [];
      for (var i = 0; i < kinds.length; i++) inputs.push({ v: mk(kinds[i]), label: kinds[i] });
      return {
        target: function (o) {
          var r = {};
          // Consommation PLAFONNEE pour les iterateurs infinis (neverDone).
          try {
            var count = 0, cap = 1000;
            var it = o[Symbol.iterator]();
            while (true) { var step = it.next(); if (!step || step.done) break; if (++count > cap) { r.capped = true; break; } }
            r.manual = count;
          } catch (e) { r.manual = e.name; }
          try { r.from = (typeof Array.from === 'function') ? Array.from({ length: 0 }).length : 'n/a'; } catch (e) { r.from = e.name; }
          // new Set(o) consomme l iterateur SANS plafond : on l evite pour l iterateur infini (neverDone).
          if (o.kind === 'neverDone') { r.set = 'evite (non plafonnable)'; }
          else { try { if (typeof Set === 'function') { new Set(o); r.set = 'ok'; } } catch (e) { r.set = e.name; } }
          return r;
        },
        inputs: inputs
      };
    }
  });

  // 6) Map/Set avec cles pieges (NaN, -0, objets a hashCode-like) : invariants d identite.
  F.invariant({
    id: 'fuzz.struct.mapset.keys', name: 'Map/Set · cles limites (invariant)', category: CAT,
    description: 'SameValueZero : NaN est une cle unique egale a elle-meme, +0 et -0 coincident.',
    requires: ['objects.Map'],
    build: function (ctx) {
      var keys = [NaN, 0, -0, '', '0', 0.0, false, null, undefined, Infinity, -Infinity];
      var inputs = [];
      for (var i = 0; i < keys.length; i++) inputs.push({ v: keys[i], label: F.previewOf(keys[i]) });
      return { inputs: inputs };
    },
    check: function (k) {
      var m = new Map();
      m.set(k, 'a'); m.set(k, 'b');         // meme cle -> ecrase
      if (m.size !== 1) return 'cle dupliquee non fusionnee (size=' + m.size + ')';
      if (m.get(k) !== 'b') return 'valeur non mise a jour';
      // NaN doit etre retrouvable malgre NaN !== NaN
      if (typeof k === 'number' && isNaN(k) && !m.has(k)) return 'NaN non retrouve comme cle';
      // +0 / -0 : SameValueZero -> une seule entree
      var m2 = new Map(); m2.set(0, 1); m2.set(-0, 2);
      if (m2.size !== 1) return '+0 et -0 traites comme distincts';
      return true;
    }
  });

  // 7) Croissance degeneree bornee : objet a tres nombreuses cles / chaine geante (sous budget).
  F.resilience({
    id: 'fuzz.struct.wide', name: 'Structures larges (bornees)', category: CAT,
    description: 'Objet a N proprietes et chaine construite par doublement : respecte le budget, mesure le cout.',
    build: function (ctx) {
      var inputs = [
        { v: 1000, label: '1 000 cles' },
        { v: 10000, label: '10 000 cles' },
        { v: 50000, label: '50 000 cles' }
      ];
      return {
        target: function (n) {
          if (ctx.charge) { if (!ctx.charge(n * 24)) throw new Error('garde-fou budget : ' + n + ' cles refusees'); }
          var o = {};
          for (var i = 0; i < n; i++) { if ((i & 1023) === 0) ctx.tick(); o['k' + i] = i; }
          var keys = Object.keys(o).length;
          var json = JSON.stringify(o).length;
          return { keys: keys, jsonChars: json };
        },
        inputs: inputs
      };
    },
    invariant: function (inp, oc) {
      if (oc.kind !== 'returned') return 'construction large a leve (' + oc.name + ')';
      if (oc.value.keys !== inp.v) return 'nombre de cles incoherent (' + oc.value.keys + ' != ' + inp.v + ')';
      return true;
    }
  });

})(typeof window !== 'undefined' ? window : this);
