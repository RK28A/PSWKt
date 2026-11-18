/*
 * PSWKT - FUZZ : tableaux types, ArrayBuffer, DataView
 * Cible la gestion memoire de bas niveau avec des tailles, offsets et indices
 * ABSURDES. L acces hors limites en JS ne corrompt PAS la memoire (il renvoie
 * undefined ou leve RangeError) : on le verifie et on le documente. Borne et
 * reproductible ; aucune allocation au-dela du budget (ctx.charge).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.fuzz;
  var R = PSWKT.runner;

  R.defineCategory('fuzz_typedarrays', 'Fuzz \u00b7 typed arrays',
    'ArrayBuffer/TypedArray/DataView: out-of-bounds sizes, offsets and indices (safe).');

  var CAT = 'fuzz_typedarrays';

  // 1) new ArrayBuffer(n) : tailles invalides/demesurees -> RangeError attendue.
  F.resilience({
    id: 'fuzz.ta.arraybuffer.size', name: 'ArrayBuffer(size) invalide', category: CAT,
    description: 'Negative/fractional/giant sizes: caught RangeError, never a crash.',
    requires: ['typedArrays.ArrayBuffer'],
    build: function (ctx) {
      var sizes = [-1, -0, 0, 0.5, 2.5, NaN, Infinity, -Infinity,
        4294967296, 9007199254740992, 1e100, 2147483648, 2147483647,
        '8', { valueOf: function () { return 16; } }, null, undefined, F.trap('throwValueOf')];
      var inputs = [];
      for (var i = 0; i < sizes.length; i++) inputs.push({ v: sizes[i], label: F.previewOf(sizes[i]) });
      return {
        target: function (n) {
          // Plafonne la taille reellement allouee pour rester non destructif.
          var num = Number(n && n.valueOf ? n.valueOf() : n);
          if (isFinite(num) && num > 8388608) throw new Error('garde-fou : taille > 8 Mo refusee (' + num + ')');
          var buf = new ArrayBuffer(n);
          if (ctx.charge) ctx.charge(buf.byteLength);
          return buf.byteLength;
        },
        inputs: inputs
      };
    }
  });

  // 2) TypedArray : acces hors limites en lecture/ecriture (doit etre inoffensif).
  F.resilience({
    id: 'fuzz.ta.oob.access', name: 'TypedArray · out-of-bounds access', category: CAT,
    description: 'Read/write at absurd indices: undefined or no-op, never corruption or crash.',
    requires: ['typedArrays.Uint8Array'],
    build: function (ctx) {
      var idx = F.nastyNumbers();
      var vals = F.nastyValues(ctx);
      var inputs = [];
      for (var i = 0; i < idx.length; i++) inputs.push(idx[i]);
      // quelques index non numeriques/pieges aussi
      for (var j = 0; j < vals.length; j++) inputs.push(vals[j]);
      return {
        target: function (i) {
          var ta = new Uint8Array(8);
          for (var k = 0; k < 8; k++) ta[k] = k + 1;
          var read = ta[i];           // hors limites -> undefined
          ta[i] = 0xFF;               // hors limites -> ignore (pas de throw)
          // Verifie l integrite : aucune case valide n a ete ecrasee par un index hors borne.
          var intact = true;
          for (var m = 0; m < 8; m++) if (ta[m] !== m + 1) intact = false;
          return { read: typeof read, intact: intact, len: ta.length };
        },
        inputs: inputs
      };
    },
    invariant: function (inp, oc) {
      // Un index objet-piege (toString/@@toPrimitive qui leve) FAIT legitimement lever
      // la coercition de cle : c est un comportement correct, pas une anomalie.
      if (oc.kind === 'threw') return true;
      // Un index entier dans [0,8) est LEGITIME : ecrire modifie cette case, c est attendu.
      var idx = inp.v;
      if (typeof idx === 'number' && idx >= 0 && idx < 8 && Math.floor(idx) === idx) return true;
      // Hors borne (negatif, >=8, fractionnaire, non numerique) : aucune case valide ne doit changer.
      return oc.value && oc.value.intact === true ? true : 'ecriture hors borne a corrompu une case valide';
    }
  });

  // 3) TypedArray.prototype.* : subarray/set/slice/fill avec offsets limites.
  F.resilience({
    id: 'fuzz.ta.methods', name: 'TypedArray.* · boundary offsets', category: CAT,
    description: 'subarray/slice/fill/copyWithin/set with absurd offsets: clamp or RangeError.',
    requires: ['typedArrays.Int32Array'],
    build: function (ctx) {
      var args = F.nastyNumbers();
      var inputs = [];
      for (var i = 0; i < args.length; i++) inputs.push(args[i]);
      return {
        target: function (a) {
          var ta = new Int32Array([10, 20, 30, 40, 50]);
          var r = {};
          try { r.sub = ta.subarray(a, a).length; } catch (e) { r.sub = e.name; }
          try { r.slice = ta.slice(a).length; } catch (e) { r.slice = e.name; }
          try { r.fill = ta.slice().fill(0, a).length; } catch (e) { r.fill = e.name; }
          if (ta.copyWithin) { try { r.cw = ta.slice().copyWithin(0, a).length; } catch (e) { r.cw = e.name; } }
          if (ta.indexOf) { try { r.idx = ta.indexOf(30, a); } catch (e) { r.idx = e.name; } }
          try { var dst = new Int32Array(5); dst.set([1, 2], a); r.set = 'ok'; } catch (e) { r.set = e.name; } // offset hors borne -> RangeError
          return r;
        },
        inputs: inputs
      };
    }
  });

  // 4) DataView : get/set hors limites et offsets absurdes -> RangeError attendue.
  F.resilience({
    id: 'fuzz.ta.dataview', name: 'DataView · out-of-bounds offsets', category: CAT,
    description: 'getInt32/setFloat64 at absurd offsets on an 8-byte buffer: caught RangeError.',
    requires: ['typedArrays.DataView'],
    build: function (ctx) {
      var offs = F.nastyNumbers();
      var inputs = [];
      for (var i = 0; i < offs.length; i++) inputs.push(offs[i]);
      inputs.push({ v: 5, label: '5 (deborde un lire-8-octets)' });
      inputs.push({ v: 7, label: '7 (deborde)' });
      inputs.push({ v: 8, label: '8 (exactement hors)' });
      return {
        target: function (o) {
          var dv = new DataView(new ArrayBuffer(8));
          var r = {};
          try { dv.setFloat64(0, 3.14); r.wrote = dv.getFloat64(0); } catch (e) { r.wrote = e.name; }
          try { r.i32 = dv.getInt32(o); } catch (e) { r.i32 = e.name; }
          try { dv.setUint32(o, 0xDEADBEEF); r.setU32 = 'ok'; } catch (e) { r.setU32 = e.name; }
          try { r.i16le = dv.getInt16(o, true); } catch (e) { r.i16le = e.name; }
          try { r.f64 = dv.getFloat64(o); } catch (e) { r.f64 = e.name; }
          return r;
        },
        inputs: inputs
      };
    }
  });

  // 5) DataView construit avec byteOffset/byteLength incoherents -> RangeError.
  F.resilience({
    id: 'fuzz.ta.dataview.ctor', name: 'DataView(buffer, offset, len) inconsistent', category: CAT,
    description: 'Construction with offset/length overflowing the buffer: caught RangeError expected.',
    requires: ['typedArrays.DataView'],
    build: function (ctx) {
      var buf = new ArrayBuffer(16);
      var combos = [
        [0, 17], [8, 16], [16, 1], [17, 0], [-1, 4], [4, -1], [2.5, 4], [4, 2.5],
        [NaN, 4], [Infinity, 4], [4, Infinity], [0, 0], [16, 0], [0, 16]
      ];
      var inputs = [];
      for (var i = 0; i < combos.length; i++) inputs.push({ v: combos[i], label: 'offset=' + combos[i][0] + ', len=' + combos[i][1] });
      return {
        target: function (c) { var dv = new DataView(buf, c[0], c[1]); return dv.byteLength; },
        inputs: inputs
      };
    }
  });

  // 6) Invariant d integrite : une ecriture TypedArray hors borne ne change RIEN aux cases valides.
  F.invariant({
    id: 'fuzz.ta.integrity', name: 'TypedArray · out-of-bounds integrity (invariant)', category: CAT,
    description: 'Writing at an index outside [0,len) must never modify a valid slot (no overflow).',
    requires: ['typedArrays.Float64Array'],
    build: function (ctx) {
      var rng = F.rngFrom(F.hashSeed('ta-integrity'));
      var inputs = [];
      for (var i = 0; i < 200; i++) {
        ctx.tick();
        // index hors [0,16) : negatifs, >=16, fractionnaires, enormes
        var choices = [-1 - F.randInt(rng, 1000), 16 + F.randInt(rng, 1000), 2.5, -0.5, NaN,
          4294967296, F.randInt(rng, 100000) + 16];
        inputs.push({ v: F.pick(rng, choices), label: 'idx hors borne' });
      }
      return { inputs: inputs };
    },
    check: function (idx) {
      var ta = new Float64Array(16);
      for (var k = 0; k < 16; k++) ta[k] = (k + 1) * 1.5;
      ta[idx] = 999999; // doit etre ignore si idx hors [0,16)
      var within = (typeof idx === 'number' && idx >= 0 && idx < 16 && Math.floor(idx) === idx);
      if (within) return true; // index legitime : non concerne
      for (var m = 0; m < 16; m++) if (ta[m] !== (m + 1) * 1.5) return 'case ' + m + ' corrompue par un index hors borne (' + idx + ')';
      return true;
    }
  });

  // 7) Uint8ClampedArray : clamp correct des valeurs limites (invariant).
  F.invariant({
    id: 'fuzz.ta.clamped', name: 'Uint8ClampedArray · clamp (invariant)', category: CAT,
    description: 'Values outside [0,255] must be clamped to 0 or 255 (nearest rounding).',
    requires: ['typedArrays.Uint8ClampedArray'],
    build: function (ctx) {
      var vals = [-1, -0.6, 0, 0.4, 0.5, 0.6, 127.5, 128.5, 254.5, 255, 255.4, 256, 1000, NaN, Infinity, -Infinity, 1e100];
      var inputs = [];
      for (var i = 0; i < vals.length; i++) inputs.push({ v: vals[i], label: String(vals[i]) });
      return { inputs: inputs };
    },
    check: function (v) {
      var ta = new Uint8ClampedArray(1);
      ta[0] = v;
      var got = ta[0];
      if (got < 0 || got > 255) return 'hors [0,255] : ' + got;
      if (isNaN(v)) return got === 0 ? true : 'NaN devrait donner 0, got ' + got;
      if (v <= 0) return got === 0 ? true : 'devrait clamp a 0, got ' + got;
      if (v >= 255) return got === 255 ? true : 'devrait clamp a 255, got ' + got;
      return true;
    }
  });

})(typeof window !== 'undefined' ? window : this);
