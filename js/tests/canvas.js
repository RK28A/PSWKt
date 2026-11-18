/*
 * PSWKT - Tests : Canvas 2D (et sondage WebGL)
 * Reproductibles et non destructifs. Dessine hors ecran, relit les pixels.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('canvas', 'Canvas & graphics', '2D context, ImageData, pixel operations, WebGL probe.');

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // 1) Contexte 2D : dessin d'un rectangle et relecture du pixel central.
  R.register({
    id: 'canvas.fill.readback',
    name: 'Remplissage 2D et relecture pixel',
    category: 'canvas',
    description: 'Remplit un carre rouge opaque et verifie le pixel via getImageData.',
    requires: ['canvas.context2d'],
    run: function (ctx) {
      var c = makeCanvas(32, 32);
      var g = c.getContext('2d');
      g.fillStyle = 'rgb(255,0,0)';
      g.fillRect(0, 0, 32, 32);
      ctx.tick();
      var px = g.getImageData(16, 16, 1, 1).data;
      var ok = (px[0] === 255 && px[1] === 0 && px[2] === 0 && px[3] === 255);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'pixel central RGBA=' + px[0] + ',' + px[1] + ',' + px[2] + ',' + px[3],
        measurements: { rgba: [px[0], px[1], px[2], px[3]] }
      };
    }
  });

  // 2) Melange alpha (source-over) : coherence du compositing.
  R.register({
    id: 'canvas.alpha.blend',
    name: 'Composition alpha source-over',
    category: 'canvas',
    description: 'Superpose un bleu semi-transparent sur un fond rouge et verifie le melange.',
    requires: ['canvas.context2d'],
    run: function (ctx) {
      var c = makeCanvas(8, 8);
      var g = c.getContext('2d');
      g.fillStyle = 'rgb(255,0,0)';
      g.fillRect(0, 0, 8, 8);
      g.globalAlpha = 0.5;
      g.fillStyle = 'rgb(0,0,255)';
      g.fillRect(0, 0, 8, 8);
      ctx.tick();
      var px = g.getImageData(4, 4, 1, 1).data;
      // Attendu approximatif : R ~128, B ~128 (source-over a 50%).
      var ok = Math.abs(px[0] - 128) <= 8 && Math.abs(px[2] - 128) <= 8;
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'melange RGBA=' + px[0] + ',' + px[1] + ',' + px[2] + ',' + px[3] + ' (attendu ~128,0,128)',
        measurements: { rgba: [px[0], px[1], px[2], px[3]] }
      };
    }
  });

  // 3) ImageData : ecriture directe des octets puis putImageData/getImageData.
  R.register({
    id: 'canvas.imagedata.roundtrip',
    name: 'ImageData aller-retour',
    category: 'canvas',
    description: 'Construit un motif en memoire, le pose, le relit, compare octet a octet.',
    requires: ['canvas.context2d', 'canvas.imageData'],
    run: function (ctx) {
      var w = 16, h = 16;
      var c = makeCanvas(w, h);
      var g = c.getContext('2d');
      var img = g.createImageData(w, h);
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        d[i] = (i / 4) % 256;      // R = index
        d[i + 1] = 0;
        d[i + 2] = 255 - ((i / 4) % 256);
        d[i + 3] = 255;            // opaque
        if ((i & 0x3FF) === 0) ctx.tick();
      }
      g.putImageData(img, 0, 0);
      var back = g.getImageData(0, 0, w, h).data;
      var mismatches = 0;
      for (var j = 0; j < d.length; j++) {
        if (d[j] !== back[j]) mismatches++;
      }
      ctx.tick();
      var ok = (mismatches === 0);
      return {
        status: ok ? 'pass' : 'fail',
        detail: ok ? 'aller-retour exact sur ' + (d.length / 4) + ' pixels' : (mismatches + ' octets differents'),
        measurements: { pixels: d.length / 4, mismatches: mismatches }
      };
    }
  });

  // 4) Debit de remplissage (mesure de duree).
  R.register({
    id: 'canvas.fillrate',
    name: 'Debit de remplissage 2D',
    category: 'canvas',
    description: 'Mesure le temps de N remplissages sur un canvas 256x256.',
    requires: ['canvas.context2d'],
    run: function (ctx) {
      var c = makeCanvas(256, 256);
      var g = c.getContext('2d');
      var N = 400;
      var t0 = PSWKT.now();
      for (var i = 0; i < N; i++) {
        var v = i % 256;
        g.fillStyle = 'rgb(' + v + ',' + ((i * 3) % 256) + ',' + ((i * 7) % 256) + ')';
        g.fillRect(0, 0, 256, 256);
        ctx.tick();
      }
      var dt = PSWKT.now() - t0;
      return {
        status: 'pass',
        detail: N + ' remplissages 256x256 en ' + Math.round(dt) + ' ms',
        measurements: { fills: N, ms: Math.round(dt * 100) / 100, fillsPerSec: Math.round(N / (dt / 1000)) }
      };
    }
  });

  // 5) Sondage WebGL : rapporte le renderer sans dependre de sa presence.
  R.register({
    id: 'canvas.webgl.probe',
    name: 'Sondage WebGL',
    category: 'canvas',
    description: 'Cree un contexte WebGL si possible et releve VENDOR/RENDERER/VERSION.',
    requires: [], // volontairement sans prerequis : on veut documenter l'absence aussi
    run: function (ctx) {
      var c = makeCanvas(1, 1);
      var gl = null;
      try { gl = c.getContext('webgl') || c.getContext('experimental-webgl'); } catch (e) {}
      ctx.tick();
      if (!gl) {
        return { status: 'skip', detail: 'WebGL indisponible dans ce navigateur', measurements: { webgl: false } };
      }
      var info = {
        webgl: true,
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
      };
      try {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          info.unmaskedVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
          info.unmaskedRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        }
      } catch (e) {}
      return {
        status: 'pass',
        detail: 'WebGL ' + info.version + ' | ' + (info.unmaskedRenderer || info.renderer),
        measurements: info
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
