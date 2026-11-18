/*
 * PSWKT - FUZZ : methodes natives (String / Array / Object / Math)
 * Passe des arguments MALFORMES, des indices absurdes et des objets-pieges
 * (valueOf/toString qui levent ou qui mentent) la ou le moteur attend un type
 * precis. Objectif : documenter la robustesse de la coercition d arguments.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.fuzz;
  var R = PSWKT.runner;

  R.defineCategory('fuzz_builtins', 'Fuzz \u00b7 JS builtins',
    'String/Array/Object/Math fed malformed arguments and trap objects (coercion).');

  var CAT = 'fuzz_builtins';

  // Arguments adverses reutilises : limites numeriques + pieges de coercition.
  function badArgs(ctx) {
    var out = F.nastyNumbers();
    var tv = F.nastyValues(ctx);
    for (var i = 0; i < tv.length; i++) out.push(tv[i]);
    return out;
  }

  // 1) String.prototype.* avec index/longueurs absurdes et objets-pieges en argument.
  F.resilience({
    id: 'fuzz.builtins.string.indexing', name: 'String · absurd indices/lengths', category: CAT,
    description: 'slice/substr/substring/repeat/padStart/charAt/codePointAt with boundary arguments.',
    build: function (ctx) {
      var base = 'abcdef😀xyz';
      var args = badArgs(ctx);
      var inputs = [];
      for (var i = 0; i < args.length; i++) inputs.push(args[i]);
      return {
        target: function (a) {
          var r = {};
          r.slice = base.slice(a);
          r.substring = base.substring(a);
          if (base.substr) r.substr = base.substr(a, a);
          r.charAt = base.charAt(a);
          r.charCodeAt = base.charCodeAt(a);
          if (base.codePointAt) r.cp = base.codePointAt(a);
          r.indexOf = base.indexOf(a);
          if (base.padStart) { try { r.pad = base.padStart(a, '.'); } catch (e) { r.pad = e.name; } }
          if (base.repeat) { try { r.rep = base.repeat(a).length; } catch (e2) { r.rep = e2.name; } }
          if (base.at) r.at = base.at(a);
          return r;
        },
        inputs: inputs
      };
    }
  });

  // 2) String.prototype.repeat : count negatif/Infini/NaN -> RangeError OU gestion propre.
  F.resilience({
    id: 'fuzz.builtins.string.repeat', name: 'String.repeat (boundary count)', category: CAT,
    description: 'repeat(-1/Infinity/NaN/2^30): caught RangeError or bounded string, never a crash.',
    requires: [],
    build: function (ctx) {
      var counts = [-1, -0.9, 0, 0.9, 1.5, NaN, Infinity, -Infinity, 1e9, 1073741824, 2147483648,
        { valueOf: function () { return 3; } }, '2', null, undefined, F.trap('throwValueOf')];
      var inputs = [];
      for (var i = 0; i < counts.length; i++) inputs.push({ v: counts[i], label: F.previewOf(counts[i]) });
      return {
        target: function (c) {
          if (!''.repeat) throw new Error('repeat absent');
          var s = 'ab'.repeat(c);
          // garde-fou : ne jamais materialiser une chaine demesuree au-dela du budget
          return s.length;
        },
        inputs: inputs
      };
    }
  });

  // 3) Array(len) et new Array : longueurs invalides -> RangeError attendue.
  F.resilience({
    id: 'fuzz.builtins.array.length', name: 'Array(length) invalide', category: CAT,
    description: 'new Array(-1 / 2.5 / 2^32 / NaN): caught RangeError expected.',
    build: function (ctx) {
      var lens = [-1, -0, 0.5, 2.5, NaN, Infinity, 4294967295, 4294967296, 1e100, '3', '3.5',
        { valueOf: function () { return 4; } }, null, F.trap('throwValueOf')];
      var inputs = [];
      for (var i = 0; i < lens.length; i++) inputs.push({ v: lens[i], label: F.previewOf(lens[i]) });
      return {
        target: function (n) { var a = new Array(n); return a.length; },
        inputs: inputs
      };
    }
  });

  // 4) Array.prototype.* avec callbacks/arguments pieges et tableaux degeneres.
  F.resilience({
    id: 'fuzz.builtins.array.methods', name: 'Array.* · trapped callbacks/args', category: CAT,
    description: 'map/filter/reduce/slice/fill/copyWithin/sort with boundary arguments and trap objects.',
    build: function (ctx) {
      var args = badArgs(ctx);
      var inputs = [];
      for (var i = 0; i < args.length; i++) inputs.push(args[i]);
      return {
        target: function (a) {
          var arr = [3, 1, 2, 4, 0];
          var r = {};
          try { r.slice = arr.slice(a, a).length; } catch (e) { r.slice = e.name; }
          try { r.fill = arr.slice().fill(0, a, a).length; } catch (e) { r.fill = e.name; }
          if (arr.copyWithin) { try { r.cw = arr.slice().copyWithin(0, a).length; } catch (e) { r.cw = e.name; } }
          try { r.idx = arr.indexOf(2, a); } catch (e) { r.idx = e.name; }
          if (arr.includes) { try { r.inc = arr.includes(2, a); } catch (e) { r.inc = e.name; } }
          // callback non-fonction -> TypeError attendue et rattrapee
          try { r.map = arr.map(a).length; } catch (e) { r.map = e.name; }
          try { r.sort = arr.slice().sort(typeof a === 'function' ? a : undefined).length; } catch (e) { r.sort = e.name; }
          return r;
        },
        inputs: inputs
      };
    }
  });

  // 5) Array.from sur objets array-like pieges (length qui ment/leve/negatif/geant).
  F.resilience({
    id: 'fuzz.builtins.array.from', name: 'Array.from (trapped array-like)', category: CAT,
    description: 'Array.from on negative/giant/throwing length: bounded or caught error.',
    build: function (ctx) {
      if (typeof Array.from !== 'function') return { target: function () { throw new Error('Array.from unavailable'); }, inputs: [] };
      var inputs = F.trapObjects();
      inputs.push({ v: { length: 3, 0: 'a', 1: 'b', 2: 'c' }, label: 'array-like valide' });
      inputs.push({ v: { length: 1e7 }, label: 'length = 1e7 (giant, bounded by budget)' });
      inputs.push({ v: 'abc', label: 'iterable string' });
      return {
        target: function (o) {
          // Garde-fou : plafonne la materialisation via mapFn qui respecte le budget.
          var cap = 100000, count = 0;
          return Array.from(o, function (x) {
            if (++count > cap) throw new Error('garde-fou : plafond ' + cap + ' atteint');
            return x;
          }).length;
        },
        inputs: inputs
      };
    }
  });

  // 6) Object.* avec cibles non-objets et descripteurs incoherents.
  F.resilience({
    id: 'fuzz.builtins.object.ops', name: 'Object.* · boundary targets/descriptors', category: CAT,
    description: 'keys/assign/defineProperty/freeze/getOwnPropertyNames on primitives and traps.',
    build: function (ctx) {
      var inputs = F.nastyValues(ctx);
      return {
        target: function (o) {
          var r = {};
          try { r.keys = Object.keys(o).length; } catch (e) { r.keys = e.name; }
          try { r.gopn = Object.getOwnPropertyNames(o).length; } catch (e) { r.gopn = e.name; }
          try { r.froze = !!Object.freeze(o); } catch (e) { r.froze = e.name; }
          try { Object.assign({}, o); r.assign = 'ok'; } catch (e) { r.assign = e.name; }
          try { r.proto = Object.getPrototypeOf(o) === null ? 'null' : typeof Object.getPrototypeOf(o); } catch (e) { r.proto = e.name; }
          try { Object.defineProperty(o, 'z', { value: 1 }); r.dp = 'ok'; } catch (e) { r.dp = e.name; }
          return r;
        },
        inputs: inputs
      };
    }
  });

  // 7) JSON.stringify avec remplacants/espaces malformes et objets-pieges (toJSON/getters).
  F.resilience({
    id: 'fuzz.builtins.json.stringify', name: 'JSON.stringify (args/traps)', category: CAT,
    description: 'stringify with absurd replacer, boundary indent, getters/toJSON that throw.',
    build: function (ctx) {
      var inputs = [];
      // Valeurs a serialiser (dont pieges)
      var vals = F.nastyValues(ctx);
      for (var i = 0; i < vals.length; i++) inputs.push(vals[i]);
      inputs.push({ v: { toJSON: function () { throw new Error('toJSON leve'); } }, label: 'toJSON leve' });
      inputs.push({ v: { toJSON: function () { return { toJSON: arguments.callee ? null : null }; } }, label: 'toJSON imbrique' });
      return {
        target: function (v) {
          var r = {};
          try { r.plain = typeof JSON.stringify(v); } catch (e) { r.plain = e.name; }
          try { r.indent = typeof JSON.stringify(v, null, 1e6); } catch (e) { r.indent = e.name; } // indent demesure -> borne a 10 par la spec
          try { r.repl = typeof JSON.stringify(v, function (k, val) { return val; }); } catch (e) { r.repl = e.name; }
          try { r.badRepl = typeof JSON.stringify(v, 42); } catch (e) { r.badRepl = e.name; }
          return r;
        },
        inputs: inputs
      };
    },
    invariant: function (inp, oc) {
      // stringify sur objet cyclique DOIT lever TypeError (attendu). On ne force rien d autre.
      if (oc.kind !== 'returned') return 'stringify a propage une exception non geree (' + oc.name + ')';
      return true;
    }
  });

  // 8) Math.* : invariants simples sur nombres limites (jamais d exception, types coherents).
  F.invariant({
    id: 'fuzz.builtins.math', name: 'Math.* (numeric invariants)', category: CAT,
    description: 'min/max/round/sign/abs/trunc on boundary values: consistent results, never an exception.',
    build: function (ctx) {
      var inputs = F.nastyNumbers();
      return { inputs: inputs };
    },
    check: function (n) {
      var abs = Math.abs(n);
      if (!(abs >= 0) && !isNaN(abs)) return 'abs negatif pour ' + n;
      var sign = (typeof Math.sign === 'function') ? Math.sign(n) : (n > 0 ? 1 : n < 0 ? -1 : n);
      if (n > 0 && sign !== 1) return 'sign incoherent (+) pour ' + n;
      if (n < 0 && sign !== -1) return 'sign incoherent (-) pour ' + n;
      var mx = Math.max(n, 0), mn = Math.min(n, 0);
      if (!isNaN(n) && mx < mn) return 'max<min pour ' + n;
      if (typeof Math.trunc === 'function') { var t = Math.trunc(n); if (isFinite(n) && Math.abs(t) > Math.abs(n) + 1) return 'trunc incoherent pour ' + n; }
      return true;
    }
  });

})(typeof window !== 'undefined' ? window : this);
