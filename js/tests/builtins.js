/*
 * PSWKT - Sondes : methodes et proprietes natives JavaScript
 * Genere une sonde de presence par membre (non destructif).
 * Objectif : cartographier finement le support du langage sur ce WebKit.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('builtins', 'Natifs JS (methodes)', 'Presence des methodes/proprietes natives : Array, String, Object, Math, Date, etc.');

  // table : { base: 'chemin', prefix: 'id', members: [...] }
  var TABLES = [
    { base: 'Array.prototype', prefix: 'bi.array', members: [
      'at', 'concat', 'copyWithin', 'entries', 'every', 'fill', 'filter', 'find', 'findIndex',
      'findLast', 'findLastIndex', 'flat', 'flatMap', 'forEach', 'includes', 'indexOf', 'join',
      'keys', 'lastIndexOf', 'map', 'pop', 'push', 'reduce', 'reduceRight', 'reverse', 'shift',
      'slice', 'some', 'sort', 'splice', 'toLocaleString', 'toReversed', 'toSorted', 'toSpliced',
      'unshift', 'values', 'with', 'group'
    ] },
    { base: 'Array', prefix: 'bi.arrayctor', members: ['from', 'isArray', 'of', 'fromAsync'] },
    { base: 'String.prototype', prefix: 'bi.string', members: [
      'at', 'charAt', 'charCodeAt', 'codePointAt', 'concat', 'endsWith', 'includes', 'indexOf',
      'isWellFormed', 'lastIndexOf', 'localeCompare', 'match', 'matchAll', 'normalize', 'padEnd',
      'padStart', 'repeat', 'replace', 'replaceAll', 'search', 'slice', 'split', 'startsWith',
      'substring', 'substr', 'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toUpperCase',
      'toWellFormed', 'trim', 'trimEnd', 'trimStart'
    ] },
    { base: 'String', prefix: 'bi.stringctor', members: ['fromCharCode', 'fromCodePoint', 'raw'] },
    { base: 'Object', prefix: 'bi.object', members: [
      'assign', 'create', 'defineProperties', 'defineProperty', 'entries', 'freeze', 'fromEntries',
      'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'getOwnPropertyNames',
      'getOwnPropertySymbols', 'getPrototypeOf', 'groupBy', 'hasOwn', 'is', 'isExtensible',
      'isFrozen', 'isSealed', 'keys', 'preventExtensions', 'seal', 'setPrototypeOf', 'values'
    ] },
    { base: 'Object.prototype', prefix: 'bi.objproto', members: [
      'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf'
    ] },
    { base: 'Number', prefix: 'bi.number', members: [
      'isFinite', 'isInteger', 'isNaN', 'isSafeInteger', 'parseFloat', 'parseInt',
      'EPSILON', 'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'MAX_VALUE', 'MIN_VALUE',
      'POSITIVE_INFINITY', 'NEGATIVE_INFINITY', 'NaN'
    ] },
    { base: 'Number.prototype', prefix: 'bi.numproto', members: ['toExponential', 'toFixed', 'toPrecision', 'toLocaleString', 'toString'] },
    { base: 'Math', prefix: 'bi.math', members: [
      'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt', 'ceil', 'clz32',
      'cos', 'cosh', 'exp', 'expm1', 'floor', 'fround', 'hypot', 'imul', 'log', 'log10', 'log1p',
      'log2', 'max', 'min', 'pow', 'random', 'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh',
      'trunc', 'E', 'PI', 'LN2', 'LN10', 'SQRT2'
    ] },
    { base: 'Date', prefix: 'bi.datector', members: ['now', 'parse', 'UTC'] },
    { base: 'Date.prototype', prefix: 'bi.date', members: [
      'getDate', 'getDay', 'getFullYear', 'getHours', 'getMilliseconds', 'getMinutes', 'getMonth',
      'getSeconds', 'getTime', 'getTimezoneOffset', 'getUTCDate', 'getUTCFullYear', 'toISOString',
      'toJSON', 'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString', 'toUTCString', 'toDateString'
    ] },
    { base: 'JSON', prefix: 'bi.json', members: ['parse', 'stringify'] },
    { base: 'Promise', prefix: 'bi.promise', members: ['all', 'allSettled', 'any', 'race', 'reject', 'resolve', 'withResolvers'] },
    { base: 'Promise.prototype', prefix: 'bi.promiseproto', members: ['then', 'catch', 'finally'] },
    { base: 'Reflect', prefix: 'bi.reflect', members: [
      'apply', 'construct', 'defineProperty', 'deleteProperty', 'get', 'getOwnPropertyDescriptor',
      'getPrototypeOf', 'has', 'isExtensible', 'ownKeys', 'preventExtensions', 'set', 'setPrototypeOf'
    ] },
    { base: 'Map.prototype', prefix: 'bi.map', members: ['clear', 'delete', 'entries', 'forEach', 'get', 'has', 'keys', 'set', 'values'] },
    { base: 'Set.prototype', prefix: 'bi.set', members: [
      'add', 'clear', 'delete', 'entries', 'forEach', 'has', 'keys', 'values',
      'union', 'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom'
    ] },
    { base: 'RegExp.prototype', prefix: 'bi.regexp', members: ['exec', 'test', 'compile'] },
    { base: 'Function.prototype', prefix: 'bi.function', members: ['apply', 'bind', 'call', 'toString'] },
    { base: 'Symbol', prefix: 'bi.symbol', members: [
      'for', 'keyFor', 'asyncIterator', 'hasInstance', 'isConcatSpreadable', 'iterator',
      'match', 'matchAll', 'replace', 'search', 'species', 'split', 'toPrimitive', 'toStringTag', 'unscopables'
    ] },
    { base: 'ArrayBuffer.prototype', prefix: 'bi.arraybuffer', members: ['slice', 'resize', 'transfer', 'byteLength', 'maxByteLength'] },
    { base: 'Intl', prefix: 'bi.intl', members: [
      'Collator', 'DateTimeFormat', 'DisplayNames', 'ListFormat', 'Locale', 'NumberFormat',
      'PluralRules', 'RelativeTimeFormat', 'Segmenter', 'getCanonicalLocales'
    ] }
  ];

  for (var t = 0; t < TABLES.length; t++) {
    var tbl = TABLES[t];
    for (var m = 0; m < tbl.members.length; m++) {
      F.presence('builtins', tbl.prefix, tbl.base + '.' + tbl.members[m], tbl.base.replace('.prototype', '') + '.' + tbl.members[m]);
    }
  }

})(typeof window !== 'undefined' ? window : this);
