/*
 * PSWKT - Sondes : capacites media (codecs audio/video)
 * Utilise canPlayType : "", "maybe" ou "probably". Pertinent pour la PS5.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('media', 'Media & codecs', 'Support des codecs audio/video via canPlayType, et API media.');

  var VIDEO = [
    'video/mp4', 'video/mp4; codecs="avc1.42E01E"', 'video/mp4; codecs="avc1.640028"',
    'video/mp4; codecs="hev1.1.6.L93.B0"', 'video/mp4; codecs="hvc1.1.6.L93.B0"',
    'video/mp4; codecs="av01.0.05M.08"', 'video/mp4; codecs="vp09.00.10.08"',
    'video/webm', 'video/webm; codecs="vp8"', 'video/webm; codecs="vp9"', 'video/webm; codecs="av01.0.05M.08"',
    'video/ogg; codecs="theora"', 'video/mp2t; codecs="avc1.42E01E"',
    'application/vnd.apple.mpegurl', 'application/x-mpegurl', 'application/dash+xml'
  ];
  var AUDIO = [
    'audio/mpeg', 'audio/mp4', 'audio/mp4; codecs="mp4a.40.2"', 'audio/mp4; codecs="mp4a.40.5"',
    'audio/aac', 'audio/ogg; codecs="vorbis"', 'audio/ogg; codecs="opus"', 'audio/webm; codecs="opus"',
    'audio/webm; codecs="vorbis"', 'audio/wav; codecs="1"', 'audio/flac', 'audio/x-flac',
    'audio/mp4; codecs="ec-3"', 'audio/mp4; codecs="ac-3"'
  ];

  for (var v = 0; v < VIDEO.length; v++) F.canPlay('media', 'vid', 'video', VIDEO[v]);
  for (var a = 0; a < AUDIO.length; a++) F.canPlay('media', 'aud', 'audio', AUDIO[a]);

  // API media (presence)
  var APIS = [
    'MediaSource', 'ManagedMediaSource', 'SourceBuffer', 'MediaRecorder', 'MediaStream',
    'HTMLMediaElement.prototype.captureStream', 'MediaCapabilities', 'navigator.mediaCapabilities',
    'navigator.mediaSession', 'AudioContext', 'webkitAudioContext', 'OfflineAudioContext',
    'AudioWorkletNode', 'AnalyserNode', 'GainNode', 'HTMLVideoElement.prototype.requestVideoFrameCallback',
    'HTMLVideoElement.prototype.requestPictureInPicture', 'EncodedVideoChunk', 'VideoDecoder',
    'VideoEncoder', 'AudioDecoder', 'ImageDecoder'
  ];
  for (var i = 0; i < APIS.length; i++) F.presence('media', 'mediaapi', APIS[i], APIS[i]);

  // MediaSource.isTypeSupported (comportemental) sur quelques conteneurs.
  var MSE = ['video/mp4; codecs="avc1.42E01E"', 'video/webm; codecs="vp9"', 'audio/mp4; codecs="mp4a.40.2"'];
  for (var k = 0; k < MSE.length; k++) {
    (function (mime) {
      R.register({
        id: 'mse.' + F.idSafe(mime),
        name: 'MSE isTypeSupported ' + mime,
        category: 'media',
        description: 'MediaSource.isTypeSupported("' + mime + '")',
        requires: [],
        quiet: true,
        run: function () {
          var ok = false, available = false;
          try {
            if (global.MediaSource && typeof global.MediaSource.isTypeSupported === 'function') {
              available = true;
              ok = global.MediaSource.isTypeSupported(mime);
            }
          } catch (e) { ok = false; }
          if (!available) return { status: 'skip', detail: 'MediaSource.isTypeSupported absent', measurements: { mime: mime } };
          return { status: ok ? 'pass' : 'skip', detail: ok ? 'supporte (MSE)' : 'non supporte (MSE)', measurements: { mime: mime, supported: ok } };
        }
      });
    })(MSE[k]);
  }

})(typeof window !== 'undefined' ? window : this);
