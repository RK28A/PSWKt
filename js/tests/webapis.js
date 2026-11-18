/*
 * PSWKT - Sondes massives : API Web (presence)
 * Cartographie non destructive d'un tres grand nombre d'API du navigateur.
 * reussi = present, ignore = absent. Genere par table (fabrique).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.factory;
  var R = PSWKT.runner;

  R.defineCategory('webapis', 'Web APIs (presence)',
    'Presence of a wide range of browser APIs: network, media, storage, sensors, crypto, observers, i18n...');

  // Constructeurs / objets globaux (chemins simples depuis window).
  var NAMES = [
    // Reseau / fetch / streams
    'fetch', 'Request', 'Response', 'Headers', 'AbortController', 'AbortSignal', 'FormData',
    'XMLHttpRequest', 'XMLHttpRequestUpload', 'WebSocket', 'EventSource', 'URL', 'URLSearchParams',
    'ReadableStream', 'WritableStream', 'TransformStream', 'ReadableStreamDefaultReader',
    'ByteLengthQueuingStrategy', 'CountQueuingStrategy', 'CompressionStream', 'DecompressionStream',
    'Blob', 'File', 'FileReader', 'FileReaderSync', 'FileList', 'BlobEvent',
    // Workers / messagerie
    'Worker', 'SharedWorker', 'ServiceWorker', 'ServiceWorkerRegistration', 'MessageChannel',
    'MessagePort', 'BroadcastChannel', 'Worklet', 'DedicatedWorkerGlobalScope',
    // Stockage
    'localStorage', 'sessionStorage', 'Storage', 'StorageManager', 'indexedDB', 'IDBFactory',
    'IDBDatabase', 'IDBObjectStore', 'IDBTransaction', 'IDBKeyRange', 'IDBCursor', 'IDBIndex',
    'IDBRequest', 'IDBOpenDBRequest', 'caches', 'CacheStorage', 'Cache', 'cookieStore',
    // Crypto
    'crypto', 'Crypto', 'SubtleCrypto', 'CryptoKey',
    // Performance / timing
    'performance', 'Performance', 'PerformanceObserver', 'PerformanceEntry',
    'PerformanceNavigationTiming', 'PerformanceResourceTiming', 'PerformancePaintTiming',
    'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'queueMicrotask',
    'structuredClone', 'reportError', 'scheduler', 'setTimeout', 'setInterval', 'setImmediate',
    // Observers
    'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'ReportingObserver',
    'PerformanceObserver',
    // Media / audio / video
    'AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'AudioWorklet', 'AudioBuffer',
    'AudioBufferSourceNode', 'GainNode', 'AnalyserNode', 'BiquadFilterNode', 'OscillatorNode',
    'MediaRecorder', 'MediaSource', 'SourceBuffer', 'MediaStream', 'MediaStreamTrack',
    'ImageCapture', 'MediaDevices', 'HTMLMediaElement', 'HTMLVideoElement', 'HTMLAudioElement',
    'TextTrack', 'VideoFrame', 'AudioData', 'EncodedVideoChunk', 'VideoEncoder', 'VideoDecoder',
    'SpeechSynthesis', 'speechSynthesis', 'SpeechSynthesisUtterance', 'SpeechRecognition',
    'webkitSpeechRecognition',
    // WebRTC
    'RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription',
    'RTCIceCandidate', 'RTCRtpSender', 'RTCRtpReceiver',
    // Graphique
    'OffscreenCanvas', 'OffscreenCanvasRenderingContext2D', 'ImageBitmap', 'createImageBitmap',
    'ImageBitmapRenderingContext', 'Path2D', 'ImageData', 'WebGLRenderingContext',
    'WebGL2RenderingContext', 'GPUAdapter', 'GPUDevice', 'CanvasGradient', 'CanvasPattern',
    'DOMMatrix', 'DOMPoint', 'DOMRect', 'DOMQuad',
    // DOM avance
    'customElements', 'CustomElementRegistry', 'ShadowRoot', 'HTMLTemplateElement', 'HTMLSlotElement',
    'DocumentFragment', 'Range', 'StaticRange', 'Selection', 'DOMParser', 'XMLSerializer',
    'NodeIterator', 'TreeWalker', 'XPathEvaluator', 'AbortSignal', 'ElementInternals',
    // CSS / style
    'CSS', 'CSSStyleSheet', 'CSSRule', 'StyleSheet', 'getComputedStyle', 'matchMedia',
    'MediaQueryList', 'CSSStyleDeclaration', 'FontFace', 'FontFaceSet', 'CSSKeyframesRule',
    'CSSSupportsRule', 'CSSContainerRule', 'Highlight', 'CSSNumericValue', 'CSSUnitValue',
    // Evenements
    'Event', 'CustomEvent', 'EventTarget', 'KeyboardEvent', 'MouseEvent', 'PointerEvent',
    'TouchEvent', 'WheelEvent', 'InputEvent', 'CompositionEvent', 'FocusEvent', 'DragEvent',
    'GamepadEvent', 'DeviceMotionEvent', 'DeviceOrientationEvent', 'MessageEvent', 'CloseEvent',
    'ErrorEvent', 'PromiseRejectionEvent', 'StorageEvent', 'PopStateEvent', 'HashChangeEvent',
    'ClipboardEvent', 'ProgressEvent', 'AnimationEvent', 'TransitionEvent', 'SubmitEvent',
    // Entrees / capteurs
    'Gamepad', 'GamepadButton', 'Accelerometer', 'Gyroscope', 'AbsoluteOrientationSensor',
    'RelativeOrientationSensor', 'AmbientLightSensor', 'Magnetometer',
    // Divers plateforme
    'Notification', 'PushManager', 'Permissions', 'PermissionStatus', 'Geolocation',
    'GeolocationCoordinates', 'Screen', 'ScreenOrientation', 'VisualViewport', 'visualViewport',
    'History', 'Location', 'Navigator', 'WorkerNavigator', 'BatteryManager', 'NetworkInformation',
    'PaymentRequest', 'PublicKeyCredential', 'CredentialsContainer', 'Bluetooth', 'USB', 'Serial',
    'HID', 'WakeLock', 'IdleDetector', 'EyeDropper', 'Observable', 'CookieStore', 'LaunchQueue',
    'DeviceMotionEvent', 'ClipboardItem', 'Sanitizer', 'TrustedTypes', 'trustedTypes',
    // Concurrence memoire
    'SharedArrayBuffer', 'Atomics', 'WeakRef', 'FinalizationRegistry',
    // i18n
    'Intl'
  ];

  // Chemins pointes (membres / sous-API).
  var PATHS = [
    'navigator.geolocation', 'navigator.permissions', 'navigator.serviceWorker',
    'navigator.mediaDevices', 'navigator.mediaDevices.getUserMedia', 'navigator.clipboard',
    'navigator.clipboard.writeText', 'navigator.clipboard.read', 'navigator.credentials',
    'navigator.storage', 'navigator.storage.estimate', 'navigator.connection', 'navigator.gpu',
    'navigator.xr', 'navigator.bluetooth', 'navigator.usb', 'navigator.serial', 'navigator.hid',
    'navigator.wakeLock', 'navigator.getBattery', 'navigator.vibrate', 'navigator.share',
    'navigator.canShare', 'navigator.sendBeacon', 'navigator.requestMIDIAccess', 'navigator.locks',
    'navigator.getGamepads', 'navigator.hardwareConcurrency', 'navigator.deviceMemory',
    'navigator.languages', 'navigator.onLine', 'navigator.userAgentData', 'navigator.cookieEnabled',
    'crypto.getRandomValues', 'crypto.randomUUID', 'crypto.subtle', 'crypto.subtle.digest',
    'crypto.subtle.encrypt', 'crypto.subtle.generateKey', 'crypto.subtle.sign',
    'performance.now', 'performance.memory', 'performance.getEntries', 'performance.mark',
    'performance.measure', 'performance.timeOrigin', 'performance.navigation',
    'WebAssembly.compile', 'WebAssembly.instantiate', 'WebAssembly.validate', 'WebAssembly.Module',
    'WebAssembly.Instance', 'WebAssembly.Memory', 'WebAssembly.Table', 'WebAssembly.Global',
    'WebAssembly.Tag', 'WebAssembly.Exception', 'WebAssembly.compileStreaming',
    'Intl.NumberFormat', 'Intl.DateTimeFormat', 'Intl.Collator', 'Intl.PluralRules',
    'Intl.RelativeTimeFormat', 'Intl.ListFormat', 'Intl.DisplayNames', 'Intl.Locale',
    'Intl.Segmenter', 'Intl.DurationFormat', 'Intl.getCanonicalLocales', 'Intl.supportedValuesOf',
    'document.fonts', 'document.fonts.ready', 'document.createElement', 'document.createRange',
    'document.caretRangeFromPoint', 'document.elementFromPoint', 'document.exitFullscreen',
    'document.requestStorageAccess', 'document.startViewTransition', 'document.adoptedStyleSheets',
    'window.requestAnimationFrame', 'window.matchMedia', 'window.getSelection', 'window.open',
    'window.scroll', 'window.devicePixelRatio', 'window.screen', 'window.history',
    'screen.orientation', 'screen.availWidth', 'history.pushState', 'history.scrollRestoration',
    'location.href', 'localStorage.setItem', 'sessionStorage.setItem',
    'AbortSignal.timeout', 'AbortSignal.any', 'Promise.withResolvers', 'Promise.allSettled',
    'Promise.any', 'Object.groupBy', 'Map.groupBy', 'Array.fromAsync', 'Iterator.prototype',
    'ArrayBuffer.prototype.transfer', 'ArrayBuffer.prototype.resize', 'Atomics.waitAsync'
  ];

  // Prefixe unique par index : idSafe() met en minuscules, donc 'crypto'/'Crypto'
  // donneraient le meme id. L'index garantit l'unicite.
  for (var i = 0; i < NAMES.length; i++) F.presence('webapis', 'wa' + i, NAMES[i], NAMES[i]);
  for (var p = 0; p < PATHS.length; p++) F.presence('webapis', 'wap' + p, PATHS[p], PATHS[p]);

})(typeof window !== 'undefined' ? window : this);
