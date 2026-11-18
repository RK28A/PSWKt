/*
 * PSWKT - FUZZ : parseurs et decodeurs
 * Envoie des entrees malformees aux parseurs/decodeurs du moteur et documente
 * leur reaction, plus quelques INVARIANTS (aller-retour) qui attrapent les vrais
 * ecarts. Tout est capture, borne et reproductible (seed).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.fuzz;
  var R = PSWKT.runner;

  R.defineCategory('fuzz_parsers', 'Fuzz \u00b7 parsers',
    'JSON.parse, Number/parseInt/parseFloat, Date, URI, RegExp: malformed inputs + invariants.');

  var CAT = 'fuzz_parsers';

  // 1) JSON.parse sur chaines malformees : doit renvoyer ou lever (jamais planter).
  F.resilience({
    id: 'fuzz.parse.json.malformed', name: 'JSON.parse (malforme)', category: CAT,
    description: 'JSON invalide/tordu : attendu SyntaxError rattrapee, jamais de plantage.',
    build: function (ctx) {
      var seeds = ['{"a":1,"b":[1,2,3],"c":"x"}', '[1,2,3]', '{"k":{"n":[true,null,false]}}', '"txt"', '12345'];
      var inputs = [];
      // Cas durs connus
      var hard = ['', '{', '}', '[', ']', '{,}', '[,]', '{"a":}', '{"a":1,}', '[1,]', 'NaN', 'Infinity',
        '-Infinity', '01', '1.', '.1', '1e', '0x1', "'simple'", '{a:1}', '{"a" 1}', 'truee',
        'nul', '[[[[[[[[[[', '{"x":"\\uZZZZ"}', '"\\x41"', '"non terminee', '{"dup":1,"dup":2}',
        '  \n\t 42 \n', '1' + new Array(40).join('0')];
      for (var h = 0; h < hard.length; h++) inputs.push({ v: hard[h], label: F.previewOf(hard[h]) });
      // Mutations reproductibles de graines valides
      for (var s = 0; s < seeds.length; s++) {
        var muts = F.mutationInputs(ctx, seeds[s], 40, F.hashSeed('json' + s));
        for (var m = 1; m < muts.length; m++) inputs.push(muts[m]); // saute la graine (valide)
      }
      return {
        target: function (str) { return JSON.parse(str); },
        inputs: inputs
      };
    }
  });

  // 2) JSON invariant : parse(stringify(x)) reconstruit des valeurs structurees.
  F.invariant({
    id: 'fuzz.parse.json.roundtrip', name: 'JSON aller-retour (invariant)', category: CAT,
    description: 'JSON.parse(JSON.stringify(x)) doit egaler x pour des structures serialisables.',
    build: function (ctx) {
      var rng = F.rngFrom(F.hashSeed('json-rt'));
      var inputs = [];
      function rand(depth) {
        if (depth <= 0 || rng() < 0.3) {
          var t = F.randInt(rng, 5);
          if (t === 0) return F.randInt(rng, 1000) - 500;
          if (t === 1) return rng() < 0.5;
          if (t === 2) return null;
          if (t === 3) return F.pick(rng, ['', 'a', 'éé', '😀', '"\\/\b\f\n\r\t', 'x\u0000y']);
          return F.randInt(rng, 2) ? [] : {};
        }
        if (rng() < 0.5) { var n = F.randInt(rng, 4), ar = []; for (var i = 0; i < n; i++) ar.push(rand(depth - 1)); return ar; }
        var o = {}, k = F.randInt(rng, 4);
        for (var j = 0; j < k; j++) o['k' + j] = rand(depth - 1);
        return o;
      }
      for (var i = 0; i < 120; i++) { ctx.tick(); var v = rand(4); inputs.push({ v: v, label: 'struct#' + i }); }
      return { inputs: inputs };
    },
    check: function (v) {
      var s = JSON.stringify(v);
      if (s === undefined) return true; // non serialisable : hors invariant
      var back = JSON.parse(s);
      return (JSON.stringify(back) === s) ? true : ('aller-retour different : ' + s + ' -> ' + JSON.stringify(back));
    }
  });

  // 3) Number() et parseInt/parseFloat : ne doivent JAMAIS lever (contrat du moteur).
  F.resilience({
    id: 'fuzz.parse.number', name: 'Number / parseInt / parseFloat (malforme)', category: CAT,
    description: 'Conversions numeriques : toujours un nombre (eventuellement NaN), jamais d exception.',
    build: function (ctx) {
      var strs = F.nastyStrings(ctx);
      var extra = ['0x', '0b101', '0o17', '1e', '1e+', '--5', '+-5', '  0x1F  ', '1_0', '1,5',
        'Infinity', '-Infinity', 'NaN', '٣', '½', '1n', '.', 'e5', '0.0.0', '  ', '\u000942\u0009'];
      var inputs = strs.slice();
      for (var i = 0; i < extra.length; i++) inputs.push({ v: extra[i], label: F.previewOf(extra[i]) });
      return {
        target: function (s) {
          var a = Number(s), b = parseInt(s, 10), c = parseFloat(s), d = parseInt(s, 16);
          // toutes ces valeurs doivent etre de type number
          return [a, b, c, d];
        },
        inputs: inputs
      };
    },
    invariant: function (inp, oc) {
      if (oc.kind !== 'returned') return 'conversion numerique a leve (' + oc.name + ')';
      var arr = oc.value;
      for (var i = 0; i < arr.length; i++) if (typeof arr[i] !== 'number') return 'resultat non numerique a l index ' + i;
      return true;
    }
  });

  // 4) Date : parsing de chaines bizarres (resultat valide OU Invalid Date, jamais d exception).
  F.resilience({
    id: 'fuzz.parse.date', name: 'Date.parse / new Date (malforme)', category: CAT,
    description: 'Dates tordues : Invalid Date (NaN) attendu, jamais de plantage.',
    build: function (ctx) {
      var cand = ['2024-13-45', '0000-00-00', '2024-02-30T99:99:99', 'not a date', '2024-02-29',
        '2023-02-29', '13/32/2024', 'Feb 30 2024', '2024-06-15T12:00:00+99:00', '', '   ',
        '2024', '2024-06', '1970-01-01T00:00:00.000Z', '2024-06-15T25:61:61', '9999999-01-01',
        '+275760-09-13', '-271821-04-20', '2024-W99', 'Mon Zzz 99 2024'];
      var inputs = [];
      for (var i = 0; i < cand.length; i++) inputs.push({ v: cand[i], label: F.previewOf(cand[i]) });
      var muts = F.mutationInputs(ctx, '2024-06-15T12:30:45.000Z', 40, F.hashSeed('date'));
      for (var m = 1; m < muts.length; m++) inputs.push(muts[m]);
      return {
        target: function (s) { var d = new Date(s); return { t: d.getTime(), p: Date.parse(s) }; },
        inputs: inputs
      };
    },
    invariant: function (inp, oc) {
      if (oc.kind !== 'returned') return 'new Date/Date.parse a leve (' + oc.name + ')';
      if (typeof oc.value.t !== 'number' || typeof oc.value.p !== 'number') return 'getTime/parse non numeriques';
      return true;
    }
  });

  // 5) URI : encode/decode avec entrees illegales ; decode d'une sequence invalide -> URIError.
  F.resilience({
    id: 'fuzz.parse.uri.decode', name: 'decodeURI(Component) (malforme)', category: CAT,
    description: 'Sequences %XX illegales : URIError rattrapee attendue, jamais de plantage.',
    build: function (ctx) {
      var cand = ['%', '%A', '%ZZ', '%E0%A4', '%C0%80', '%F8%88%80%80%80', '%ed%a0%80',
        '100%', 'a%b', '%%', '%u0041', '+', ' ', '%20%', '%FF', '%00', '\uD800'];
      var inputs = [];
      for (var i = 0; i < cand.length; i++) inputs.push({ v: cand[i], label: F.previewOf(cand[i]) });
      var muts = F.mutationInputs(ctx, 'caf%C3%A9%20%2F%3F', 36, F.hashSeed('uri'));
      for (var m = 1; m < muts.length; m++) inputs.push(muts[m]);
      return {
        target: function (s) {
          var out = {};
          try { out.dC = decodeURIComponent(s); } catch (e) { out.dC = e.name; }
          try { out.dU = decodeURI(s); } catch (e2) { out.dU = e2.name; }
          return out;
        },
        inputs: inputs
      };
    }
  });

  // 6) URI invariant : decodeURIComponent(encodeURIComponent(x)) === x (aller-retour exact).
  F.invariant({
    id: 'fuzz.parse.uri.roundtrip', name: 'URI aller-retour (invariant)', category: CAT,
    description: 'decodeURIComponent(encodeURIComponent(x)) doit redonner x, y compris Unicode.',
    build: function (ctx) {
      var rng = F.rngFrom(F.hashSeed('uri-rt'));
      var pool = 'abc /?#&=%+ éà😀\u0000\t\n"\'<>'.split('');
      var inputs = [];
      for (var i = 0; i < 120; i++) {
        ctx.tick();
        var n = F.randInt(rng, 20), s = '';
        for (var j = 0; j < n; j++) s += F.pick(rng, pool);
        inputs.push({ v: s, label: F.previewOf(s) });
      }
      return { inputs: inputs };
    },
    check: function (v) {
      // Chaines avec surrogates isolees : hors contrat (encodeURIComponent leve URIError).
      try {
        var enc = encodeURIComponent(v);
        var dec = decodeURIComponent(enc);
        return (dec === v) ? true : ('aller-retour different pour ' + F.previewOf(v));
      } catch (e) {
        // Attendu uniquement si la chaine contient une surrogate isolee.
        if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/.test(v)) return true;
        return 'encode/decode a leve sur une chaine pourtant bien formee (' + e.name + ')';
      }
    }
  });

  // 7) RegExp : compilation de patterns aleatoires/malformes -> SyntaxError rattrapee.
  F.resilience({
    id: 'fuzz.parse.regexp.compile', name: 'RegExp (compilation malformee)', category: CAT,
    description: 'Construction de motifs tordus : SyntaxError rattrapee attendue, jamais de plantage.',
    build: function (ctx) {
      var rng = F.rngFrom(F.hashSeed('re-compile'));
      var atoms = '()[]{}|*+?.^$\\abc09-,:=!<>dswDSWbBnrt'.split('');
      var inputs = [];
      var fixed = ['(', ')', '[', '[a-', '(?<', '(?<name>', '\\', '\\p{', '*', '+?', '{2,1}',
        '(?:', 'a{', '[]', '[^]', '(?P<x>)', '\\k<x>', '(?<=a)', '(?<!a)', '(a)\\1', '(?i)', '[\\u{1F600}]'];
      for (var f = 0; f < fixed.length; f++) inputs.push({ v: fixed[f], label: F.previewOf(fixed[f]) });
      for (var i = 0; i < 80; i++) {
        ctx.tick();
        var n = 1 + F.randInt(rng, 12), p = '';
        for (var j = 0; j < n; j++) p += F.pick(rng, atoms);
        inputs.push({ v: p, label: F.previewOf(p) });
      }
      // Quelques entrees avec flags invalides pour sonder la validation de drapeaux.
      var badFlags = ['gg', 'x', 'z', 'gimsuyd'];
      for (var bf = 0; bf < badFlags.length; bf++) inputs.push({ v: 'abc', flag: badFlags[bf], label: 'flags="' + badFlags[bf] + '"' });
      return {
        target: function (p, meta) { return new RegExp(p, (meta && meta.flag) || ''); },
        inputs: inputs
      };
    }
  });

  // 8) RegExp : backtracking (ReDoS) BORNE. Entree courte -> cout plafonne, on MESURE le temps.
  //    Non destructif : la chaine est volontairement tres courte pour rester sous l echeance.
  F.resilience({
    id: 'fuzz.parse.regexp.backtrack', name: 'RegExp · backtracking borne', category: CAT,
    description: 'Motifs a backtracking exponentiel sur entrees TRES courtes (<=16) : on mesure le cout, sans bloquer.',
    build: function (ctx) {
      var patterns = [/(a+)+$/, /(a|a)*$/, /(a*)*$/, /(.*a){1,}$/, /(a+)+b/];
      var inputs = [];
      for (var p = 0; p < patterns.length; p++) {
        for (var len = 4; len <= 16; len += 4) {
          var str = new Array(len + 1).join('a') + 'X'; // ne matche jamais -> pire cas
          inputs.push({ v: { re: patterns[p], s: str }, label: patterns[p].source + ' @' + len });
        }
      }
      return {
        target: function (job) { return job.re.test(job.s); },
        inputs: inputs
      };
    },
    invariant: function (inp, oc) {
      if (oc.kind !== 'returned') return 'test() a leve (' + oc.name + ')';
      // Signal d alerte doux : un seul appel > 250 ms est suspect (ReDoS) mais non fatal.
      if (oc.ms > 250) return 'appel lent (' + Math.round(oc.ms) + ' ms) : backtracking couteux sur ' + inp.label;
      return true;
    }
  });

})(typeof window !== 'undefined' ? window : this);
