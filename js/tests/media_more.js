/*
 * PSWKT - Sondes media supplementaires (codecs + MediaSource + MediaCapabilities)
 * Complete la categorie "Media & codecs". Non destructif.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  var VIDEO = [
    // AVC (profils varies)
    'video/mp4; codecs="avc1.4D401E"', 'video/mp4; codecs="avc1.64001F"', 'video/mp4; codecs="avc1.640033"',
    'video/mp4; codecs="avc3.42E01E"',
    // HEVC (profils/niveaux)
    'video/mp4; codecs="hev1.2.4.L120.B0"', 'video/mp4; codecs="hvc1.1.6.L120.90"',
    'video/mp4; codecs="hev1.1.6.L150.B0"',
    // AV1 (profils/niveaux)
    'video/mp4; codecs="av01.0.00M.08"', 'video/mp4; codecs="av01.0.08M.10"', 'video/mp4; codecs="av01.1.04M.10"',
    // VP9 profils
    'video/webm; codecs="vp09.00.10.08"', 'video/webm; codecs="vp09.02.10.10"',
    'video/mp4; codecs="vp09.00.51.08.01.01.01.01.00"',
    // Dolby Vision
    'video/mp4; codecs="dvh1.05.06"', 'video/mp4; codecs="dvhe.05.06"', 'video/mp4; codecs="dav1.10.09"',
    // Conteneurs
    'video/3gpp', 'video/quicktime', 'video/x-matroska', 'video/mpeg', 'video/x-flv'
  ];
  var AUDIO = [
    'audio/mpeg; codecs="mp3"', 'audio/mp4; codecs="mp4a.40.29"', 'audio/mp4; codecs="mp4a.67"',
    'audio/mp4; codecs="ac-4"', 'audio/mp4; codecs="mha1.02"', 'audio/mp4; codecs="dtsc"',
    'audio/mp4; codecs="dtse"', 'audio/mp4; codecs="alac"', 'audio/mp4; codecs="Opus"',
    'audio/ogg; codecs="flac"', 'audio/webm; codecs="pcm"', 'audio/3gpp', 'audio/amr',
    'audio/x-aiff', 'audio/basic', 'audio/midi', 'audio/x-m4a'
  ];

  for (var v = 0; v < VIDEO.length; v++) F.canPlay('media', 'vid2' + v, 'video', VIDEO[v]);
  for (var a = 0; a < AUDIO.length; a++) F.canPlay('media', 'aud2' + a, 'audio', AUDIO[a]);

  // MediaSource.isTypeSupported (MSE) : different de canPlayType.
  var MSE = [
    'video/mp4; codecs="avc1.42E01E"', 'video/mp4; codecs="hev1.1.6.L93.B0"',
    'video/mp4; codecs="av01.0.05M.08"', 'video/webm; codecs="vp9"',
    'audio/mp4; codecs="mp4a.40.2"', 'audio/webm; codecs="opus"', 'audio/mpeg'
  ];
  for (var m = 0; m < MSE.length; m++) {
    (function (mime, idx) {
      R.register({
        id: 'media.mse.' + idx, name: 'MSE isTypeSupported ' + mime, category: 'media',
        description: 'MediaSource.isTypeSupported("' + mime + '")', requires: [], quiet: true,
        run: function () {
          var ok = false;
          try { ok = !!(global.MediaSource && MediaSource.isTypeSupported && MediaSource.isTypeSupported(mime)); } catch (e) { ok = false; }
          return { status: ok ? 'pass' : 'skip', detail: ok ? 'supporte en MSE' : 'non supporte en MSE', measurements: { mime: mime, mse: ok } };
        }
      });
    })(MSE[m], m);
  }

})(typeof window !== 'undefined' ? window : this);
