/*
 * PSWKT - Tests : chaines, texte, Unicode, expressions regulieres
 * Techniques variees : sondage par try/catch, encodage binaire, comparaison
 * de methodes de construction, mesures de debit.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('strings', 'Strings & text', 'Unicode, normalization, regex, encoding, base64, build throughput.');

  // 1) Unicode : points de code hors BMP (emoji), surrogate pairs.
  R.register({
    id: 'str.unicode.codepoints',
    name: 'Unicode beyond BMP (code points)',
    category: 'strings',
    description: 'Checks codePointAt / fromCodePoint on an emoji (surrogate pair).',
    requires: [],
    run: function (ctx) {
      var emoji = '😀'; // U+1F600
      ctx.info('UTF-16 length = ' + emoji.length + ' (attendu 2)');
      var cp = emoji.codePointAt ? emoji.codePointAt(0) : null;
      ctx.info('codePointAt(0) = U+' + (cp ? cp.toString(16).toUpperCase() : '?'));
      var rebuilt = String.fromCodePoint ? String.fromCodePoint(0x1F600) : null;
      var ok = (emoji.length === 2 && cp === 0x1F600 && rebuilt === emoji);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'length=' + emoji.length + ', codePoint=U+' + (cp ? cp.toString(16) : '?') + ', reconstruit=' + (rebuilt === emoji),
        measurements: { utf16Length: emoji.length, codePoint: cp, rebuiltOk: rebuilt === emoji }
      };
    }
  });

  // 2) Normalisation Unicode (NFC/NFD).
  R.register({
    id: 'str.normalize',
    name: 'Normalisation NFC / NFD',
    category: 'strings',
    description: 'Compare "e accent" compose (NFC) et decompose (NFD).',
    requires: ['lang.stringNormalize'],
    run: function (ctx) {
      var composed = 'é';          // é precompose
      var decomposed = 'é';       // e + accent combinant
      ctx.info('composed.length=' + composed.length + ', decomposed.length=' + decomposed.length);
      var nfc = decomposed.normalize('NFC');
      var nfd = composed.normalize('NFD');
      var ok = (nfc === composed && nfd === decomposed && composed !== decomposed);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'NFC(decompose)===compose : ' + (nfc === composed) + ', NFD(compose)===decompose : ' + (nfd === decomposed),
        measurements: { composedLen: composed.length, decomposedLen: decomposed.length, nfcOk: nfc === composed, nfdOk: nfd === decomposed }
      };
    }
  });

  // 3) Sondage des fonctionnalites regex avancees (sans planter le parseur).
  R.register({
    id: 'str.regex.features',
    name: 'Expressions regulieres avancees',
    category: 'strings',
    description: 'Sonde groupes nommes, lookbehind, proprietes Unicode, flag dotAll.',
    requires: [],
    run: function (ctx) {
      function probe(label, pattern, flags, testStr, expect) {
        try {
          var re = new RegExp(pattern, flags);
          var got = re.test(testStr);
          ctx.info('regex ' + label + ' : supporte, test=' + got);
          return { supported: true, ok: got === expect };
        } catch (e) {
          ctx.info('regex ' + label + ' : NON supporte (' + e.name + ')');
          return { supported: false, ok: false };
        }
      }
      var named = probe('groupes nommes', '(?<year>\\d{4})', '', '2026', true);
      var look = probe('lookbehind', '(?<=\\$)\\d+', '', '$42', true);
      var uni = probe('propriete Unicode \\p{L}', '\\p{L}+', 'u', 'abc', true);
      var dot = probe('dotAll', 'a.b', 's', 'a\nb', true);
      // Statut informatif : on documente le support, pas un echec si absent.
      return {
        status: 'pass',
        detail: 'nommes=' + named.supported + ', lookbehind=' + look.supported +
          ', \\p{L}=' + uni.supported + ', dotAll=' + dot.supported,
        measurements: { namedGroups: named, lookbehind: look, unicodeProp: uni, dotAll: dot }
      };
    }
  });

  // 4) Encodage UTF-8 via TextEncoder/TextDecoder (aller-retour binaire).
  R.register({
    id: 'str.textencoder',
    name: 'TextEncoder / TextDecoder (UTF-8)',
    category: 'strings',
    description: 'Encodes an accented string to UTF-8 bytes and decodes it.',
    requires: ['platform.TextEncoder', 'platform.TextDecoder'],
    run: function (ctx) {
      var src = 'Café € 😀'; // Café € 😀
      var enc = new TextEncoder();
      var bytes = enc.encode(src);
      ctx.info('encode -> ' + bytes.length + ' octets UTF-8');
      ctx.metric('premiers octets', Array.prototype.slice.call(bytes.subarray(0, 8)));
      var dec = new TextDecoder('utf-8');
      var back = dec.decode(bytes);
      var ok = (back === src);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'bytes=' + bytes.length + ', aller-retour=' + ok,
        measurements: { byteLength: bytes.length, roundTrip: ok }
      };
    }
  });

  // 5) base64 (btoa/atob) sur donnees binaires.
  R.register({
    id: 'str.base64',
    name: 'base64 (btoa / atob)',
    category: 'strings',
    description: 'Encodes/decodes a byte sequence in base64 and checks fidelity.',
    requires: ['platform.base64'],
    run: function (ctx) {
      var raw = '';
      for (var i = 0; i < 256; i++) raw += String.fromCharCode(i);
      var b64 = global.btoa(raw);
      ctx.info('base64 length=' + b64.length + ' (pour 256 octets)');
      var back = global.atob(b64);
      var ok = (back.length === 256);
      var identical = true;
      for (var j = 0; j < 256; j++) { if (back.charCodeAt(j) !== j) { identical = false; break; } }
      return {
        status: (ok && identical) ? 'pass' : 'fail',
        detail: 'longueur b64=' + b64.length + ', aller-retour identique=' + identical,
        measurements: { b64Length: b64.length, decodedLength: back.length, identical: identical }
      };
    }
  });

  // 6) Comparaison de methodes de construction de chaine (debit).
  R.register({
    id: 'str.build.methods',
    name: 'Building: concat vs join',
    category: 'strings',
    description: 'Compare concatenation += et Array.join sur 50000 morceaux.',
    requires: [],
    run: function (ctx) {
      var N = 50000;
      // Methode A : concatenation incrementale
      var tA = PSWKT.now();
      var s = '';
      for (var i = 0; i < N; i++) {
        s += 'x';
        if ((i & 0x1FFF) === 0) ctx.tick(0x1FFF);
      }
      var dA = PSWKT.now() - tA;
      ctx.info('concatenation += : ' + Math.round(dA * 100) / 100 + ' ms');
      // Methode B : tableau + join
      var tB = PSWKT.now();
      var parts = new Array(N);
      for (var k = 0; k < N; k++) {
        parts[k] = 'x';
        if ((k & 0x1FFF) === 0) ctx.tick(0x1FFF);
      }
      var s2 = parts.join('');
      var dB = PSWKT.now() - tB;
      ctx.info('array + join: ' + Math.round(dB * 100) / 100 + ' ms');
      var ok = (s.length === N && s2.length === N);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'concat ' + Math.round(dA) + ' ms vs join ' + Math.round(dB) + ' ms (longueur ' + s.length + ')',
        measurements: { n: N, concatMs: Math.round(dA * 100) / 100, joinMs: Math.round(dB * 100) / 100 }
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
