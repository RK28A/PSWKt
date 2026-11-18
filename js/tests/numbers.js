/*
 * PSWKT - Tests : nombres, precision flottante, BigInt, Math
 * Documente le comportement arithmetique reel du moteur.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('numbers', 'Numbers & arithmetic', 'IEEE-754 precision, safe integers, BigInt, Math, conversions.');

  // 1) Precision flottante : le fameux 0.1 + 0.2.
  R.register({
    id: 'num.float.precision',
    name: 'IEEE-754 precision (0.1 + 0.2)',
    category: 'numbers',
    description: 'Documents the expected binary imprecision and its workaround.',
    requires: [],
    run: function (ctx) {
      var sum = 0.1 + 0.2;
      ctx.info('0.1 + 0.2 = ' + sum + ' (representation complete : ' + sum.toPrecision(20) + ')');
      var exactlyEqual = (sum === 0.3);
      var closeEnough = Math.abs(sum - 0.3) < Number.EPSILON * 4;
      ctx.info('=== 0.3 strict : ' + exactlyEqual + ' | proche (EPSILON) : ' + closeEnough);
      // Comportement attendu et correct : sum !== 0.3 mais proche.
      var ok = (!exactlyEqual && closeEnough);
      return {
        status: ok ? 'pass' : 'fail',
        detail: '0.1+0.2=' + sum + ', ===0.3 : ' + exactlyEqual + ', proche : ' + closeEnough,
        measurements: { sum: sum, precision20: sum.toPrecision(20), strictEqual: exactlyEqual, closeEnough: closeEnough, epsilon: Number.EPSILON }
      };
    }
  });

  // 2) Entiers surs et perte de precision au-dela de 2^53.
  R.register({
    id: 'num.safe.integers',
    name: 'Safe integers (MAX_SAFE_INTEGER)',
    category: 'numbers',
    description: 'Shows the precision loss beyond 2^53-1.',
    requires: [],
    run: function (ctx) {
      var max = Number.MAX_SAFE_INTEGER;
      ctx.info('MAX_SAFE_INTEGER = ' + max);
      var a = max + 1;
      var b = max + 2;
      ctx.info('(max+1) === (max+2) : ' + (a === b) + ' -> perte de precision attendue');
      var collide = (a === b);
      var isSafe = Number.isSafeInteger(max) && !Number.isSafeInteger(max + 1);
      var ok = collide && isSafe;
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'max=' + max + ', (max+1)===(max+2) : ' + collide + ', isSafe consistent: ' + isSafe,
        measurements: { max: max, collisionAbove: collide, isSafeCoherent: isSafe }
      };
    }
  });

  // 3) BigInt : arithmetique exacte sur grands entiers.
  R.register({
    id: 'num.bigint',
    name: 'BigInt (arithmetique exacte)',
    category: 'numbers',
    description: 'Calcule 2^100 et une factorielle en BigInt.',
    requires: ['lang.BigInt'],
    run: function (ctx) {
      /* global BigInt */
      var two = BigInt(2);
      var p = two;
      for (var i = 1; i < 100; i++) { p = p * two; ctx.tick(); }
      var pStr = p.toString();
      ctx.info('2^100 = ' + pStr);
      var expected = '1267650600228229401496703205376';
      // Factorielle 25
      var f = BigInt(1);
      for (var k = 2; k <= 25; k++) { f = f * BigInt(k); ctx.tick(); }
      ctx.info('25! = ' + f.toString());
      var ok = (pStr === expected && f.toString() === '15511210043330985984000000');
      return {
        status: ok ? 'pass' : 'fail',
        detail: '2^100 ' + (pStr === expected ? 'exact' : 'INCORRECT') + ', 25! calcule',
        measurements: { pow2_100: pStr, fact25: f.toString(), pow2Ok: pStr === expected }
      };
    }
  });

  // 4) Math : fonctions et determinisme.
  R.register({
    id: 'num.math',
    name: 'Fonctions Math',
    category: 'numbers',
    description: 'Checks sqrt, cbrt, hypot, fround, clz32, sign.',
    requires: [],
    run: function (ctx) {
      var checks = {
        sqrt: Math.sqrt(144) === 12,
        pow: Math.pow(2, 10) === 1024,
        hypot: (typeof Math.hypot === 'function') ? Math.abs(Math.hypot(3, 4) - 5) < 1e-12 : 'absent',
        cbrt: (typeof Math.cbrt === 'function') ? Math.abs(Math.cbrt(27) - 3) < 1e-12 : 'absent',
        fround: (typeof Math.fround === 'function') ? (Math.fround(1.1) !== 1.1) : 'absent',
        clz32: (typeof Math.clz32 === 'function') ? (Math.clz32(1) === 31) : 'absent',
        sign: (typeof Math.sign === 'function') ? (Math.sign(-5) === -1) : 'absent',
        trunc: (typeof Math.trunc === 'function') ? (Math.trunc(-4.7) === -4) : 'absent'
      };
      for (var key in checks) { if (checks.hasOwnProperty(key)) ctx.info('Math.' + key + ' : ' + checks[key]); }
      var fail = false;
      for (var k in checks) { if (checks[k] === false) fail = true; }
      return {
        status: fail ? 'fail' : 'pass',
        detail: 'sqrt/pow ok, extensions: see measurements',
        measurements: checks
      };
    }
  });

  // 5) Conversions et operations bit a bit (32 bits).
  R.register({
    id: 'num.bitwise',
    name: 'Bitwise operations (32-bit)',
    category: 'numbers',
    description: 'Checks the signed 32-bit behaviour of bitwise operators.',
    requires: [],
    run: function (ctx) {
      var shift = 1 << 31;           // attendu : -2147483648 (int32 signe)
      var unsigned = (1 << 31) >>> 0; // attendu : 2147483648
      var xor = (0xF0F0 ^ 0x0F0F);   // attendu : 0xFFFF
      var and = (0xFF00 & 0x0FF0);   // attendu : 0x0F00
      ctx.info('1<<31 = ' + shift + ' (int32 signe)');
      ctx.info('(1<<31)>>>0 = ' + unsigned + ' (non signe)');
      var ok = (shift === -2147483648 && unsigned === 2147483648 && xor === 0xFFFF && and === 0x0F00);
      return {
        status: ok ? 'pass' : 'fail',
        detail: '1<<31=' + shift + ', >>>0=' + unsigned + ', xor=' + xor.toString(16) + ', and=' + and.toString(16),
        measurements: { shift31: shift, unsigned: unsigned, xor: xor, and: and }
      };
    }
  });

  // 6) parseInt / parseFloat / Number : cas limites.
  R.register({
    id: 'num.parsing',
    name: 'Number parsing',
    category: 'numbers',
    description: 'Documents parseInt/parseFloat/Number on ambiguous inputs.',
    requires: [],
    run: function (ctx) {
      var cases = {
        'parseInt("0x1F")': parseInt('0x1F'),      // 31
        'parseInt("08")': parseInt('08'),          // 8 (pas octal en ES5+)
        'parseInt("12px")': parseInt('12px'),      // 12
        'parseFloat("3.14abc")': parseFloat('3.14abc'), // 3.14
        'Number("")': Number(''),                  // 0
        'Number("  42 ")': Number('  42 '),        // 42
        'Number("1e3")': Number('1e3'),            // 1000
        'parseInt("")': parseInt('')               // NaN
      };
      for (var key in cases) { if (cases.hasOwnProperty(key)) ctx.info(key + ' = ' + cases[key]); }
      var ok = (cases['parseInt("0x1F")'] === 31 && cases['parseInt("12px")'] === 12 &&
        cases['Number("")'] === 0 && isNaN(cases['parseInt("")']));
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'edge cases conform to ECMAScript: ' + ok,
        measurements: cases
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
