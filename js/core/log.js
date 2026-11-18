/*
 * PSWKT - Journal (log) central
 * Enregistre : evenements, resultats de tests, mesures de duree, erreurs JS globales.
 * Compatible WebKit ancien (ES2015). Aucune dependance externe.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  // Horloge haute resolution avec repli sur Date.now().
  function now() {
    if (global.performance && typeof global.performance.now === 'function') {
      return global.performance.now();
    }
    return Date.now();
  }

  function isoStamp() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return '' + Date.now();
    }
  }

  // Serialisation defensive : evite les cycles et les objets non serialisables.
  function safeData(data) {
    if (data === undefined) return undefined;
    var seen = [];
    try {
      return JSON.parse(JSON.stringify(data, function (key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.indexOf(value) !== -1) return '[Circular]';
          seen.push(value);
        }
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'bigint') return value.toString() + 'n';
        return value;
      }));
    } catch (e) {
      try { return String(data); } catch (e2) { return '[Unserializable]'; }
    }
  }

  function Logger() {
    this.t0 = now();
    this.events = [];
    this.globalErrors = [];
    this.listeners = [];
    this._maxEvents = 50000; // garde-fou memoire eleve (logs ultra-detailles). Le flux serveur continu n'est jamais tronque, lui.
  }

  Logger.prototype.reset = function () {
    this.t0 = now();
    this.events = [];
    this.globalErrors = [];
    this._emit({ type: 'reset' });
  };

  Logger.prototype.subscribe = function (fn) {
    this.listeners.push(fn);
    var self = this;
    return function () {
      var i = self.listeners.indexOf(fn);
      if (i !== -1) self.listeners.splice(i, 1);
    };
  };

  Logger.prototype._emit = function (payload) {
    for (var i = 0; i < this.listeners.length; i++) {
      try { this.listeners[i](payload); } catch (e) { /* un listener ne doit pas casser le journal */ }
    }
  };

  // level : info | pass | fail | warn | error | skip | metric
  Logger.prototype.log = function (level, source, msg, data) {
    var entry = {
      t: Math.round((now() - this.t0) * 1000) / 1000,
      iso: isoStamp(),
      level: level,
      source: source || 'general',
      msg: msg,
      data: safeData(data)
    };
    this.events.push(entry);
    if (this.events.length > this._maxEvents) {
      this.events.splice(0, this.events.length - this._maxEvents);
    }
    this._emit({ type: 'event', entry: entry });
    return entry;
  };

  Logger.prototype.info = function (source, msg, data) { return this.log('info', source, msg, data); };
  Logger.prototype.warn = function (source, msg, data) { return this.log('warn', source, msg, data); };
  Logger.prototype.metric = function (source, msg, data) { return this.log('metric', source, msg, data); };

  // Capture des erreurs JS globales (hors try/catch des tests).
  Logger.prototype.captureGlobalError = function (err) {
    var rec = {
      t: Math.round((now() - this.t0) * 1000) / 1000,
      iso: isoStamp(),
      name: (err && err.name) || 'Error',
      message: (err && err.message) || String(err),
      stack: (err && err.stack) ? String(err.stack) : null,
      source: (err && err.sourceHint) || null
    };
    this.globalErrors.push(rec);
    this.log('error', 'global', rec.name + ': ' + rec.message, { stack: rec.stack, source: rec.source });
    return rec;
  };

  // Rend tout le journal sous forme de texte aligne, pret a copier/analyser.
  Logger.prototype.toText = function () {
    var lines = [];
    lines.push('# PSWKT - journal (' + this.events.length + ' lignes, ' + isoStamp() + ')');
    for (var i = 0; i < this.events.length; i++) {
      var e = this.events[i];
      var t = ('          ' + e.t.toFixed(2)).slice(-10);
      var lvl = ((e.level || '').toUpperCase() + '      ').slice(0, 6);
      var line = '[' + t + 'ms] ' + lvl + ' [' + e.source + '] ' + e.msg;
      if (e.data !== undefined) {
        try { line += ' | ' + JSON.stringify(e.data); } catch (x) { /* ignore */ }
      }
      lines.push(line);
    }
    if (this.globalErrors.length) {
      lines.push('# erreurs JS globales : ' + this.globalErrors.length);
      for (var k = 0; k < this.globalErrors.length; k++) {
        var ge = this.globalErrors[k];
        lines.push('  (' + ge.t + 'ms) ' + ge.name + ': ' + ge.message + (ge.source ? ('  @' + ge.source) : ''));
      }
    }
    return lines.join('\n');
  };

  Logger.prototype.snapshot = function () {
    return {
      durationMs: Math.round((now() - this.t0) * 1000) / 1000,
      events: this.events.slice(),
      globalErrors: this.globalErrors.slice()
    };
  };

  PSWKT.now = now;
  PSWKT.isoStamp = isoStamp;
  PSWKT.safeData = safeData;
  PSWKT.logger = new Logger();

  // Branche les capteurs d'erreurs globales le plus tot possible.
  global.addEventListener('error', function (ev) {
    var err = ev.error || { name: 'Error', message: ev.message };
    err.sourceHint = (ev.filename ? ev.filename : '') + (ev.lineno ? (':' + ev.lineno) : '') +
      (ev.colno ? (':' + ev.colno) : '');
    PSWKT.logger.captureGlobalError(err);
  });
  global.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason || {};
    var err = (reason instanceof Error) ? reason : { name: 'UnhandledRejection', message: PSWKT.safeData(reason) };
    err.sourceHint = 'promise';
    PSWKT.logger.captureGlobalError(err);
  });

})(typeof window !== 'undefined' ? window : this);
