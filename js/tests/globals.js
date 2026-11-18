/*
 * PSWKT - Sondes : objets globaux et API Web
 * Presence des constructeurs/objets/fonctions exposes par le navigateur.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('globals', 'Objets globaux & API Web', 'Presence des constructeurs et API exposes par le navigateur.');

  var NAMES = [
    // Types fondamentaux et collections
    'Object', 'Function', 'Array', 'Boolean', 'Number', 'BigInt', 'String', 'Symbol', 'Date',
    'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError',
    'URIError', 'AggregateError', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'FinalizationRegistry',
    'Proxy', 'Reflect', 'Promise', 'GeneratorFunction',
    // Memoire binaire
    'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics',
    'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
    'Int32Array', 'Uint32Array', 'Float16Array', 'Float32Array', 'Float64Array',
    'BigInt64Array', 'BigUint64Array',
    // i18n / texte
    'Intl', 'TextEncoder', 'TextDecoder', 'TextEncoderStream', 'TextDecoderStream',
    // WebAssembly
    'WebAssembly',
    // Concurrence
    'Worker', 'SharedWorker', 'ServiceWorker', 'MessageChannel', 'MessagePort', 'BroadcastChannel',
    'Atomics', 'queueMicrotask',
    // Reseau
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Headers', 'Request', 'Response',
    'FormData', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FileReaderSync',
    // Flux
    'ReadableStream', 'WritableStream', 'TransformStream', 'ByteLengthQueuingStrategy',
    'CompressionStream', 'DecompressionStream',
    // Crypto / perf / timing
    'crypto', 'SubtleCrypto', 'performance', 'PerformanceObserver', 'requestAnimationFrame',
    'cancelAnimationFrame', 'requestIdleCallback', 'setTimeout', 'setInterval', 'structuredClone',
    // Observers
    'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'PerformanceObserver',
    // Evenements / abort
    'Event', 'CustomEvent', 'EventTarget', 'AbortController', 'AbortSignal',
    // Stockage
    'localStorage', 'sessionStorage', 'indexedDB', 'IDBDatabase', 'caches', 'CacheStorage',
    // Media / graphismes
    'Image', 'ImageData', 'ImageBitmap', 'createImageBitmap', 'OffscreenCanvas', 'Path2D',
    'MediaSource', 'MediaRecorder', 'AudioContext', 'webkitAudioContext', 'OfflineAudioContext',
    'HTMLCanvasElement', 'HTMLVideoElement', 'WebGLRenderingContext', 'WebGL2RenderingContext',
    'GPU',
    // Entrees / peripheriques
    'Gamepad', 'GamepadButton', 'PointerEvent', 'TouchEvent', 'KeyboardEvent', 'WheelEvent',
    // Divers plateforme
    'Notification', 'navigator', 'screen', 'history', 'location', 'matchMedia', 'getComputedStyle',
    'CSS', 'DOMParser', 'XPathEvaluator', 'Range', 'Selection', 'ResizeObserverEntry'
  ];

  // Chemins particuliers (sous navigator / window)
  var PATHS = [
    'navigator.hardwareConcurrency', 'navigator.deviceMemory', 'navigator.getGamepads',
    'navigator.vibrate', 'navigator.clipboard', 'navigator.share', 'navigator.serviceWorker',
    'navigator.permissions', 'navigator.mediaDevices', 'navigator.connection', 'navigator.languages',
    'navigator.onLine', 'navigator.cookieEnabled', 'navigator.userActivation', 'navigator.gpu',
    'navigator.storage', 'navigator.wakeLock', 'crypto.subtle', 'crypto.randomUUID',
    'performance.now', 'performance.memory', 'performance.getEntries', 'performance.mark',
    'window.devicePixelRatio', 'document.fullscreenEnabled', 'document.visibilityState',
    'window.isSecureContext'
  ];

  var seen = {};
  for (var i = 0; i < NAMES.length; i++) {
    if (seen[NAMES[i]]) continue;
    seen[NAMES[i]] = 1;
    F.presence('globals', 'glb', NAMES[i], NAMES[i]);
  }
  for (var p = 0; p < PATHS.length; p++) {
    F.presence('globals', 'glbpath', PATHS[p], PATHS[p]);
  }

})(typeof window !== 'undefined' ? window : this);
