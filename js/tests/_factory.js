/*
 * PSWKT - Fabrique de tests pilotee par donnees
 * Permet de generer des centaines de sondes individuelles (non destructives) a
 * partir de tables : presence d'API, CSS.supports, syntaxe ES, codecs, Canvas/WebGL.
 * Convention de statut pour une sonde de capacite :
 *   pass = supporte / present ; skip = absent / non supporte ; fail = present mais incoherent.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  // Resout un chemin "A.prototype.b" depuis l'objet global, sans lever.
  function resolve(path) {
    try {
      var parts = path.split('.');
      var cur = global;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return undefined;
        cur = cur[parts[i]];
      }
      return cur;
    } catch (e) { return undefined; }
  }

  function idSafe(s) {
    return String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  }

  // Contextes graphiques mis en cache (crees une seule fois, hors document).
  var _ctx2d = null, _ctx2dTried = false;
  function ctx2d() {
    if (_ctx2dTried) return _ctx2d;
    _ctx2dTried = true;
    try { _ctx2d = document.createElement('canvas').getContext('2d'); } catch (e) { _ctx2d = null; }
    return _ctx2d;
  }
  var _gl = null, _glTried = false;
  function gl() {
    if (_glTried) return _gl;
    _glTried = true;
    try {
      var c = document.createElement('canvas');
      _gl = c.getContext('webgl') || c.getContext('experimental-webgl') || null;
    } catch (e) { _gl = null; }
    return _gl;
  }
  var _glExt = null;
  function glExtensions() {
    if (_glExt) return _glExt;
    var g = gl();
    try { _glExt = g ? (g.getSupportedExtensions() || []) : []; } catch (e) { _glExt = []; }
    return _glExt;
  }

  var factory = {
    resolve: resolve,
    idSafe: idSafe,
    ctx2d: ctx2d,
    gl: gl,
    glExtensions: glExtensions,

    // Sonde de presence d'une API par chemin.
    presence: function (category, prefix, path, label) {
      R.register({
        id: prefix + '.' + idSafe(path),
        name: label || path,
        category: category,
        description: 'Presence: ' + path,
        requires: [],
        quiet: true,
        run: function () {
          var v = resolve(path);
          var present = (v !== undefined && v !== null);
          return {
            status: present ? 'pass' : 'skip',
            detail: present ? ('disponible (' + typeof v + ')') : 'absent',
            measurements: { path: path, present: present, type: present ? typeof v : null }
          };
        }
      });
    },

    // Sonde CSS.supports(property, value).
    css: function (category, prefix, prop, value, label) {
      R.register({
        id: prefix + '.' + idSafe(prop + '_' + value),
        name: label || (prop + ': ' + value),
        category: category,
        description: 'CSS.supports(' + prop + ', ' + value + ')',
        requires: [],
        quiet: true,
        run: function () {
          var ok = false;
          try { ok = !!(global.CSS && CSS.supports && CSS.supports(prop, value)); } catch (e) { ok = false; }
          return {
            status: ok ? 'pass' : 'skip',
            detail: ok ? 'supporte' : 'non supporte',
            measurements: { property: prop, value: value, supported: ok }
          };
        }
      });
    },

    // Sonde de syntaxe ES : eval d'un extrait ; SyntaxError => non supporte.
    syntax: function (category, prefix, name, code, label) {
      R.register({
        id: prefix + '.' + idSafe(name),
        name: label || name,
        category: category,
        description: 'Syntaxe : ' + name,
        requires: [],
        quiet: true,
        run: function () {
          var supported, note = '';
          try {
            /* eslint-disable no-eval */
            global.eval(code);
            supported = true;
          } catch (e) {
            if (e && e.name === 'SyntaxError') { supported = false; note = 'SyntaxError'; }
            else { supported = true; note = 'execute (' + (e && e.name) + ')'; }
          }
          return {
            status: supported ? 'pass' : 'skip',
            detail: supported ? ('syntaxe acceptee' + (note ? ' [' + note + ']' : '')) : 'refusee (SyntaxError)',
            measurements: { feature: name, supported: supported }
          };
        }
      });
    },

    // Sonde codec media via canPlayType.
    canPlay: function (category, prefix, kind, mime, label) {
      R.register({
        id: prefix + '.' + idSafe(kind + '_' + mime),
        name: label || (kind + ' ' + mime),
        category: category,
        description: kind + '.canPlayType("' + mime + '")',
        requires: [],
        quiet: true,
        run: function () {
          var verdict = '';
          try {
            var elem = document.createElement(kind);
            if (elem && typeof elem.canPlayType === 'function') verdict = elem.canPlayType(mime) || '';
          } catch (e) { verdict = ''; }
          var ok = (verdict === 'probably' || verdict === 'maybe');
          return {
            status: ok ? 'pass' : 'skip',
            detail: verdict ? ('reponse : "' + verdict + '"') : 'non supporte ("")',
            measurements: { mime: mime, verdict: verdict }
          };
        }
      });
    },

    // Sonde d'un membre du contexte Canvas 2D.
    canvas2dMember: function (category, prefix, member) {
      R.register({
        id: prefix + '.' + idSafe(member),
        name: 'ctx2d.' + member,
        category: category,
        description: 'Membre CanvasRenderingContext2D : ' + member,
        requires: ['canvas.context2d'],
        quiet: true,
        run: function () {
          var c = ctx2d();
          if (!c) return { status: 'skip', detail: '2D context unavailable', measurements: { member: member, present: false } };
          var present = (member in c) || (typeof c[member] !== 'undefined');
          return {
            status: present ? 'pass' : 'skip',
            detail: present ? ('present (' + typeof c[member] + ')') : 'absent',
            measurements: { member: member, present: present, type: present ? typeof c[member] : null }
          };
        }
      });
    },

    // Sonde d'une extension WebGL.
    webglExtension: function (category, prefix, extName) {
      R.register({
        id: prefix + '.' + idSafe(extName),
        name: extName,
        category: category,
        description: 'Extension WebGL : ' + extName,
        requires: [],
        quiet: true,
        run: function () {
          var g = gl();
          if (!g) return { status: 'skip', detail: 'WebGL unavailable', measurements: { ext: extName, present: false } };
          var listed = glExtensions().indexOf(extName) !== -1;
          var obj = null;
          try { obj = g.getExtension(extName); } catch (e) { obj = null; }
          var present = listed || !!obj;
          return {
            status: present ? 'pass' : 'skip',
            detail: present ? 'disponible' : 'absente',
            measurements: { ext: extName, listed: listed, obtained: !!obj }
          };
        }
      });
    }
  };

  PSWKT.factory = factory;

})(typeof window !== 'undefined' ? window : this);
