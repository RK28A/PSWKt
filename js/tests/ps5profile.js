/*
 * PSWKT - Tests : profil PS5 / WebKit (detaille, comportemental)
 * Releve des informations precises et utiles au diagnostic sur la console.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('ps5', 'PS5 / WebKit profile', 'WebKit version, GPU, screen/HDR, time resolution, quirks.');

  // 1) Decodage du User-Agent et extraction de la version WebKit.
  R.register({
    id: 'ps5.useragent',
    name: 'User-Agent et version WebKit',
    category: 'ps5',
    description: 'Extrait la version AppleWebKit et les indices PlayStation du UA.',
    requires: [],
    run: function (ctx) {
      var ua = (global.navigator && global.navigator.userAgent) || '';
      ctx.info('UA = ' + ua);
      var wk = ua.match(/AppleWebKit\/([\d.]+)/);
      var ps = ua.match(/PlayStation[^;)]*/i);
      var safari = ua.match(/Version\/([\d.]+)/);
      var webkitVersion = wk ? wk[1] : null;
      ctx.info('WebKit = ' + webkitVersion + ' | PlayStation = ' + (ps ? ps[0] : 'non detecte'));
      return {
        status: 'pass',
        detail: 'WebKit ' + (webkitVersion || '?') + (ps ? (' | ' + ps[0]) : ' | PlayStation non detectee'),
        measurements: {
          userAgent: ua,
          appleWebKitVersion: webkitVersion,
          safariVersion: safari ? safari[1] : null,
          playstation: ps ? ps[0] : null
        }
      };
    }
  });

  // 2) GPU reel via WebGL (unmasked renderer) - utile pour identifier le hardware PS5.
  R.register({
    id: 'ps5.gpu',
    name: 'GPU et pilote (WebGL)',
    category: 'ps5',
    description: 'Releve VENDOR/RENDERER demasques et la version GLSL.',
    requires: [],
    run: function (ctx) {
      var canvas = document.createElement('canvas');
      var gl = null;
      try { gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); } catch (e) {}
      if (!gl) return { status: 'skip', detail: 'WebGL indisponible', measurements: null };
      var info = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
      };
      try {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          info.unmaskedVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
          info.unmaskedRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        }
      } catch (e) {}
      ctx.info('renderer = ' + (info.unmaskedRenderer || info.renderer));
      ctx.info('version = ' + info.version + ' | GLSL = ' + info.glsl);
      return {
        status: 'pass',
        detail: (info.unmaskedRenderer || info.renderer) + ' | ' + info.version,
        measurements: info
      };
    }
  });

  // 3) Ecran, HDR, gamut, densite de pixels.
  R.register({
    id: 'ps5.display',
    name: 'Ecran, HDR et gamut',
    category: 'ps5',
    description: 'Releve resolution, profondeur, dynamic-range et color-gamut via matchMedia.',
    requires: [],
    run: function (ctx) {
      var scr = global.screen || {};
      function mm(q) { try { return !!(global.matchMedia && global.matchMedia(q).matches); } catch (e) { return null; } }
      var data = {
        width: scr.width, height: scr.height, colorDepth: scr.colorDepth,
        devicePixelRatio: global.devicePixelRatio || null,
        hdrHigh: mm('(dynamic-range: high)'),
        gamutP3: mm('(color-gamut: p3)'),
        gamutRec2020: mm('(color-gamut: rec2020)'),
        gamutSrgb: mm('(color-gamut: srgb)'),
        prefersDark: mm('(prefers-color-scheme: dark)'),
        pointerCoarse: mm('(pointer: coarse)'),
        pointerFine: mm('(pointer: fine)'),
        hoverNone: mm('(hover: none)')
      };
      ctx.info('ecran ' + data.width + 'x' + data.height + ' @' + data.devicePixelRatio);
      ctx.info('HDR=' + data.hdrHigh + ', P3=' + data.gamutP3 + ', rec2020=' + data.gamutRec2020);
      return {
        status: 'pass',
        detail: data.width + 'x' + data.height + ' @' + data.devicePixelRatio + ', HDR=' + data.hdrHigh + ', P3=' + data.gamutP3,
        measurements: data
      };
    }
  });

  // 4) Resolution de l'horloge performance.now (precision temporelle reelle).
  R.register({
    id: 'ps5.clock.resolution',
    name: 'Resolution de performance.now',
    category: 'ps5',
    description: 'Mesure le plus petit increment non nul observable de l horloge.',
    requires: ['timing.performanceNow'],
    run: function (ctx) {
      var minDelta = Infinity;
      var last = PSWKT.now();
      var samples = 0;
      var deadline = PSWKT.now() + 50; // 50 ms d'echantillonnage
      while (PSWKT.now() < deadline && samples < 2000000) {
        var t = PSWKT.now();
        var d = t - last;
        if (d > 0 && d < minDelta) minDelta = d;
        last = t;
        samples++;
        if ((samples & 0xFFFF) === 0) ctx.tick(0xFFFF);
      }
      if (!isFinite(minDelta)) minDelta = 0;
      ctx.info('increment minimal observe = ' + minDelta + ' ms sur ' + samples + ' echantillons');
      return {
        status: 'pass',
        detail: 'resolution ~' + minDelta + ' ms (' + samples + ' echantillons)',
        measurements: { minDeltaMs: minDelta, samples: samples }
      };
    }
  });

  // 5) Capacites navigator synthetiques.
  R.register({
    id: 'ps5.navigator',
    name: 'Capacites navigator',
    category: 'ps5',
    description: 'Synthese : coeurs, memoire, langues, securite, stockage.',
    requires: [],
    run: function (ctx) {
      var n = global.navigator || {};
      var data = {
        hardwareConcurrency: n.hardwareConcurrency || null,
        deviceMemory: n.deviceMemory || null,
        languages: n.languages ? Array.prototype.slice.call(n.languages) : null,
        onLine: n.onLine,
        cookieEnabled: n.cookieEnabled,
        maxTouchPoints: n.maxTouchPoints,
        pdfViewerEnabled: n.pdfViewerEnabled,
        isSecureContext: global.isSecureContext,
        hasClipboard: !!(n.clipboard && n.clipboard.writeText),
        hasShare: typeof n.share === 'function',
        hasServiceWorker: !!n.serviceWorker,
        hasStorage: !!n.storage
      };
      for (var k in data) { if (data.hasOwnProperty(k)) ctx.info(k + ' = ' + JSON.stringify(data[k])); }
      return {
        status: 'pass',
        detail: 'coeurs=' + data.hardwareConcurrency + ', secureContext=' + data.isSecureContext,
        measurements: data
      };
    }
  });

  // 6) Quirks connus de WebKit : comportements historiques a verifier.
  R.register({
    id: 'ps5.webkit.quirks',
    name: 'Quirks WebKit (comportements)',
    category: 'ps5',
    description: 'Verifie quelques comportements specifiques historiquement variables sur WebKit.',
    requires: [],
    run: function (ctx) {
      var q = {};
      // Date.parse de format non ISO (historiquement variable)
      q.dateParseNonIso = !isNaN(Date.parse('2026/01/15'));
      // Tri stable d'Array.sort
      var arr = [{ k: 1, v: 'a' }, { k: 1, v: 'b' }, { k: 0, v: 'c' }];
      arr.sort(function (x, y) { return x.k - y.k; });
      q.stableSort = (arr[1].v === 'a' && arr[2].v === 'b');
      // Precision de toFixed
      q.toFixedBanker = (0.5).toFixed(0);
      // typeof null
      q.typeofNull = typeof null;
      // Comportement NaN !== NaN
      q.nanSelf = (NaN === NaN);
      // Negative zero
      q.negZero = Object.is(-0, 0);
      for (var k in q) { if (q.hasOwnProperty(k)) ctx.info(k + ' = ' + q[k]); }
      return {
        status: 'pass',
        detail: 'tri stable=' + q.stableSort + ', Date.parse non-ISO=' + q.dateParseNonIso,
        measurements: q
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
