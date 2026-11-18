/*
 * PSWKT - Sondes massives : methodes natives supplementaires
 * Complete la categorie "Natifs JS" avec TypedArray, DataView, Reflect, Intl,
 * Promise, Date, RegExp, Symbol, Number, Math, Object... (presence, non destructif).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.factory;

  var TABLES = [
    { base: 'Uint8Array.prototype', prefix: 'bix.ta', members: [
      'at', 'copyWithin', 'entries', 'every', 'fill', 'filter', 'find', 'findIndex', 'findLast',
      'findLastIndex', 'forEach', 'includes', 'indexOf', 'join', 'keys', 'lastIndexOf', 'map',
      'reduce', 'reduceRight', 'reverse', 'set', 'slice', 'some', 'sort', 'subarray', 'toReversed',
      'toSorted', 'values', 'with', 'toLocaleString' ] },
    { base: 'Uint8Array', prefix: 'bix.tactor', members: ['from', 'of', 'fromBase64', 'fromHex'] },
    { base: 'Uint8Array.prototype', prefix: 'bix.tab64', members: ['toBase64', 'toHex', 'setFromBase64', 'setFromHex'] },
    { base: 'DataView.prototype', prefix: 'bix.dv', members: [
      'getInt8', 'getUint8', 'getInt16', 'getUint16', 'getInt32', 'getUint32', 'getFloat16',
      'getFloat32', 'getFloat64', 'getBigInt64', 'getBigUint64', 'setInt8', 'setUint8', 'setInt16',
      'setUint16', 'setInt32', 'setUint32', 'setFloat32', 'setFloat64', 'setBigInt64' ] },
    { base: 'ArrayBuffer.prototype', prefix: 'bix.ab', members: ['slice', 'resize', 'transfer', 'transferToFixedLength'] },
    { base: 'Reflect', prefix: 'bix.reflect', members: [
      'apply', 'construct', 'defineProperty', 'deleteProperty', 'get', 'getOwnPropertyDescriptor',
      'getPrototypeOf', 'has', 'isExtensible', 'ownKeys', 'preventExtensions', 'set', 'setPrototypeOf' ] },
    { base: 'Object', prefix: 'bix.object', members: [
      'assign', 'create', 'defineProperties', 'defineProperty', 'entries', 'freeze',
      'fromEntries', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'getOwnPropertyNames',
      'getOwnPropertySymbols', 'getPrototypeOf', 'groupBy', 'hasOwn', 'is', 'isExtensible',
      'isFrozen', 'isSealed', 'keys', 'preventExtensions', 'seal', 'setPrototypeOf', 'values' ] },
    { base: 'Number', prefix: 'bix.number', members: [
      'isFinite', 'isInteger', 'isNaN', 'isSafeInteger', 'parseFloat', 'parseInt',
      'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'EPSILON', 'MAX_VALUE', 'MIN_VALUE' ] },
    { base: 'Number.prototype', prefix: 'bix.numproto', members: ['toExponential', 'toFixed', 'toPrecision', 'toLocaleString'] },
    { base: 'Math', prefix: 'bix.math', members: [
      'abs', 'acosh', 'asinh', 'atanh', 'cbrt', 'clz32', 'cosh', 'expm1', 'fround', 'hypot',
      'imul', 'log10', 'log1p', 'log2', 'sign', 'sinh', 'tanh', 'trunc', 'f16round', 'sumPrecise' ] },
    { base: 'Date.prototype', prefix: 'bix.date', members: [
      'getTime', 'getTimezoneOffset', 'toISOString', 'toJSON', 'toLocaleDateString',
      'toLocaleTimeString', 'toLocaleString', 'getUTCHours', 'setUTCHours' ] },
    { base: 'Date', prefix: 'bix.datector', members: ['now', 'parse', 'UTC'] },
    { base: 'RegExp.prototype', prefix: 'bix.regexp', members: ['exec', 'test', 'compile', 'flags', 'source', 'global', 'sticky', 'unicode', 'dotAll', 'hasIndices'] },
    { base: 'Promise', prefix: 'bix.promise', members: ['all', 'allSettled', 'any', 'race', 'reject', 'resolve', 'withResolvers'] },
    { base: 'Map.prototype', prefix: 'bix.map', members: ['clear', 'delete', 'entries', 'forEach', 'get', 'has', 'keys', 'set', 'values'] },
    { base: 'Set.prototype', prefix: 'bix.set', members: [
      'add', 'clear', 'delete', 'difference', 'entries', 'forEach', 'has', 'intersection',
      'isDisjointFrom', 'isSubsetOf', 'isSupersetOf', 'symmetricDifference', 'union', 'values' ] },
    { base: 'JSON', prefix: 'bix.json', members: ['parse', 'stringify', 'rawJSON', 'isRawJSON'] },
    { base: 'Symbol', prefix: 'bix.symbol', members: [
      'for', 'keyFor', 'asyncIterator', 'hasInstance', 'isConcatSpreadable', 'iterator', 'match',
      'matchAll', 'replace', 'search', 'species', 'split', 'toPrimitive', 'toStringTag', 'unscopables', 'dispose', 'asyncDispose' ] },
    { base: 'Function.prototype', prefix: 'bix.func', members: ['apply', 'bind', 'call', 'toString'] },
    { base: 'Error', prefix: 'bix.error', members: ['captureStackTrace', 'isError', 'stackTraceLimit'] },
    { base: 'Intl', prefix: 'bix.intl', members: ['NumberFormat', 'DateTimeFormat', 'Collator', 'PluralRules', 'RelativeTimeFormat', 'ListFormat', 'DisplayNames', 'Locale', 'Segmenter', 'DurationFormat', 'supportedValuesOf'] }
  ];

  for (var t = 0; t < TABLES.length; t++) {
    var tb = TABLES[t];
    for (var m = 0; m < tb.members.length; m++) {
      // Prefixe unique par (table, index) pour eviter toute collision d'id apres idSafe().
      F.presence('builtins', tb.prefix + '_' + m, tb.base + '.' + tb.members[m], tb.base.replace('.prototype', '') + '.' + tb.members[m]);
    }
  }

})(typeof window !== 'undefined' ? window : this);
