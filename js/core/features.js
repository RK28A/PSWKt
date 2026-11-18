/*
 * PSWKT - Detection de fonctionnalites et environnement
 * Verifie ce qui est REELLEMENT disponible dans le navigateur avant d'executer les tests.
 * Non destructif : se contente de sonder la presence des API.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  function has(path) {
    try {
      var parts = path.split('.');
      var cur = global;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return false;
        cur = cur[parts[i]];
      }
      return cur !== undefined && cur !== null;
    } catch (e) {
      return false;
    }
  }

  function typeOf(path) {
    try {
      var parts = path.split('.');
      var cur = global;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return 'undefined';
        cur = cur[parts[i]];
      }
      return typeof cur;
    } catch (e) {
      return 'error';
    }
  }

  // Teste un constructeur sans lever d'exception non geree.
  function canConstruct(name, args) {
    try {
      var C = global[name];
      if (typeof C !== 'function') return false;
      /* eslint-disable no-new */
      if (args && args.length) {
        new C(args[0]);
      } else {
        new C();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function detectEnvironment() {
    var nav = global.navigator || {};
    var scr = global.screen || {};
    var env = {
      userAgent: nav.userAgent || 'inconnu',
      platform: nav.platform || 'inconnu',
      language: nav.language || 'inconnu',
      vendor: nav.vendor || 'inconnu',
      hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
      deviceMemoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
      screen: {
        width: scr.width || null,
        height: scr.height || null,
        colorDepth: scr.colorDepth || null,
        pixelRatio: typeof global.devicePixelRatio === 'number' ? global.devicePixelRatio : null
      },
      viewport: {
        innerWidth: global.innerWidth || null,
        innerHeight: global.innerHeight || null
      },
      timeOrigin: (global.performance && global.performance.timeOrigin) || null,
      capturedAt: PSWKT.isoStamp()
    };
    return env;
  }

  // Indices sur la PlayStation 5 (purement informatif, jamais presente comme certitude).
  function detectPlaystationHint(env) {
    var ua = (env.userAgent || '').toLowerCase();
    var hints = [];
    if (ua.indexOf('playstation 5') !== -1) hints.push('userAgent contient "PlayStation 5"');
    if (ua.indexOf('playstation') !== -1) hints.push('userAgent contient "PlayStation"');
    return {
      likelyPlaystation: hints.length > 0,
      hints: hints
    };
  }

  function detectFeatures() {
    var f = {};

    // Tableaux types
    f.typedArrays = {
      ArrayBuffer: has('ArrayBuffer'),
      Int8Array: has('Int8Array'),
      Uint8Array: has('Uint8Array'),
      Uint8ClampedArray: has('Uint8ClampedArray'),
      Int16Array: has('Int16Array'),
      Uint16Array: has('Uint16Array'),
      Int32Array: has('Int32Array'),
      Uint32Array: has('Uint32Array'),
      Float32Array: has('Float32Array'),
      Float64Array: has('Float64Array'),
      BigInt64Array: has('BigInt64Array'),
      BigUint64Array: has('BigUint64Array'),
      DataView: has('DataView'),
      SharedArrayBuffer: has('SharedArrayBuffer'),
      Atomics: has('Atomics'),
      resizableArrayBuffer: (function () {
        try { return typeof ArrayBuffer.prototype.resize === 'function'; } catch (e) { return false; }
      })()
    };

    // Objets et reflection
    f.objects = {
      Proxy: has('Proxy'),
      Reflect: has('Reflect'),
      Symbol: has('Symbol'),
      Map: has('Map'),
      Set: has('Set'),
      WeakMap: has('WeakMap'),
      WeakSet: has('WeakSet'),
      WeakRef: has('WeakRef'),
      FinalizationRegistry: has('FinalizationRegistry'),
      BigInt: typeOf('BigInt') === 'function',
      structuredClone: typeOf('structuredClone') === 'function',
      ObjectFreeze: typeof Object.freeze === 'function',
      ObjectAssign: typeof Object.assign === 'function'
    };

    // Canvas et graphismes
    f.canvas = {
      canvasElement: (function () {
        try { return !!document.createElement('canvas').getContext; } catch (e) { return false; }
      })(),
      context2d: (function () {
        try { return !!document.createElement('canvas').getContext('2d'); } catch (e) { return false; }
      })(),
      webgl: (function () {
        try {
          var c = document.createElement('canvas');
          return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
        } catch (e) { return false; }
      })(),
      webgl2: (function () {
        try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
      })(),
      offscreenCanvas: has('OffscreenCanvas'),
      imageData: has('ImageData'),
      path2d: has('Path2D')
    };

    // Timing et ordonnancement (utile pour les garde-fous)
    f.timing = {
      performanceNow: !!(global.performance && typeof global.performance.now === 'function'),
      performanceMemory: !!(global.performance && global.performance.memory),
      requestAnimationFrame: typeOf('requestAnimationFrame') === 'function',
      setTimeout: typeOf('setTimeout') === 'function',
      queueMicrotask: typeOf('queueMicrotask') === 'function',
      Promise: has('Promise')
    };

    // Concurrence et stockage
    f.platform = {
      WebAssembly: has('WebAssembly'),
      Worker: has('Worker'),
      localStorage: (function () {
        try { return !!global.localStorage; } catch (e) { return false; }
      })(),
      Blob: has('Blob'),
      URLcreateObjectURL: !!(global.URL && typeof global.URL.createObjectURL === 'function'),
      clipboard: !!(global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function'),
      TextEncoder: has('TextEncoder'),
      TextDecoder: has('TextDecoder')
    };

    return f;
  }

  PSWKT.features = {
    has: has,
    typeOf: typeOf,
    canConstruct: canConstruct,
    detectEnvironment: detectEnvironment,
    detectFeatures: detectFeatures,
    detectPlaystationHint: detectPlaystationHint,
    // Rapport complet mis en cache apres premier appel.
    _cache: null,
    report: function () {
      if (this._cache) return this._cache;
      var env = detectEnvironment();
      this._cache = {
        environment: env,
        playstation: detectPlaystationHint(env),
        features: detectFeatures()
      };
      return this._cache;
    }
  };

})(typeof window !== 'undefined' ? window : this);
