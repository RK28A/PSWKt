/*
 * PSWKT - Export des resultats
 * Construit un rapport JSON complet + une version texte lisible.
 * Trois voies de recuperation, pensees pour le navigateur PS5 :
 *   1) telechargement via Blob (peut echouer sur console)
 *   2) copie presse-papiers (si l'API existe)
 *   3) zone de texte selectionnable (fonctionne partout : copier manuellement)
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  // Ne conserve que les annotations reellement renseignees (etiquette ou note).
  function collectAnnotations() {
    var src = PSWKT.annotations || {};
    var out = {};
    var count = 0;
    for (var id in src) {
      if (!src.hasOwnProperty(id)) continue;
      var a = src[id];
      if (a && (a.tag || (a.note && a.note.length))) {
        out[id] = { name: a.name || null, tag: a.tag || '', note: a.note || '' };
        count++;
      }
    }
    return { count: count, items: out };
  }

  function buildReport(lastRun) {
    var featuresReport = PSWKT.features.report();
    var snap = PSWKT.logger.snapshot();
    var annotations = collectAnnotations();
    return {
      annotations: annotations,
      meta: {
        tool: 'PSWKT - Laboratoire de tests WebKit',
        formatVersion: 1,
        generatedAt: PSWKT.isoStamp(),
        href: (global.location && global.location.href) || null
      },
      environment: featuresReport.environment,
      playstation: featuresReport.playstation,
      features: featuresReport.features,
      run: lastRun ? {
        summary: lastRun.summary,
        records: lastRun.records
      } : null,
      log: {
        durationMs: snap.durationMs,
        globalErrors: snap.globalErrors,
        events: snap.events
      }
    };
  }

  function toJSON(report) {
    try {
      return JSON.stringify(report, null, 2);
    } catch (e) {
      return '{"error":"serialisation impossible: ' + (e && e.message) + '"}';
    }
  }

  function toText(report) {
    var L = [];
    function line(s) { L.push(s == null ? '' : String(s)); }
    line('=== PSWKT - Rapport de diagnostic WebKit ===');
    line('Genere : ' + report.meta.generatedAt);
    line('URL    : ' + report.meta.href);
    line('');
    line('--- Environnement ---');
    line('User-Agent : ' + report.environment.userAgent);
    line('Plateforme : ' + report.environment.platform);
    line('Coeurs     : ' + report.environment.hardwareConcurrency);
    line('Memoire GB : ' + report.environment.deviceMemoryGB);
    line('Ecran      : ' + report.environment.screen.width + 'x' + report.environment.screen.height +
      ' @' + report.environment.screen.pixelRatio);
    line('PlayStation probable : ' + report.playstation.likelyPlaystation +
      (report.playstation.hints.length ? (' (' + report.playstation.hints.join('; ') + ')') : ''));
    line('');

    if (report.run && report.run.summary) {
      var s = report.run.summary;
      line('--- Resume execution ---');
      line('Total : ' + s.total + '  |  reussis : ' + s.counts.pass +
        '  echecs : ' + s.counts.fail + '  erreurs : ' + s.counts.error +
        '  ignores : ' + s.counts.skip + '  arretes : ' + s.counts.aborted);
      line('Duree totale : ' + s.totalDurationMs + ' ms' + (s.suiteAborted ? '  (SUITE INTERROMPUE)' : ''));
      line('');
      line('--- Detail des tests ---');
      for (var i = 0; i < report.run.records.length; i++) {
        var r = report.run.records[i];
        line('[' + r.status.toUpperCase() + '] ' + r.name + '  (' + r.durationMs + ' ms)');
        if (r.detail) line('    ' + r.detail);
        if (r.error) line('    ERREUR ' + r.error.name + ': ' + r.error.message);
        if (r.measurements) line('    mesures : ' + JSON.stringify(r.measurements));
        var an = report.annotations.items[r.id];
        if (an && (an.tag || an.note)) line('    >> ANNOTATION : ' + (an.tag ? ('[' + an.tag + '] ') : '') + (an.note || ''));
      }
      line('');
    }

    if (report.annotations && report.annotations.count) {
      line('--- Annotations (' + report.annotations.count + ') ---');
      var items = report.annotations.items;
      for (var id in items) {
        if (!items.hasOwnProperty(id)) continue;
        var a = items[id];
        line('[' + (a.tag || '-') + '] ' + (a.name || id) + (a.note ? (' : ' + a.note) : ''));
      }
      line('');
    }

    if (report.log.globalErrors.length) {
      line('--- Erreurs JS globales (' + report.log.globalErrors.length + ') ---');
      for (var k = 0; k < report.log.globalErrors.length; k++) {
        var ge = report.log.globalErrors[k];
        line('(' + ge.t + ' ms) ' + ge.name + ': ' + ge.message + (ge.source ? ('  @' + ge.source) : ''));
      }
      line('');
    }

    line('Note : une erreur JavaScript observee ici est un comportement a documenter,');
    line('elle ne constitue pas en soi une vulnerabilite.');
    return L.join('\n');
  }

  function filename(ext) {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    return 'pswkt-rapport-' + stamp + '.' + ext;
  }

  // Tente un telechargement via Blob. Renvoie true si l'anchor a ete declenche.
  function downloadText(content, name, mime) {
    try {
      if (!global.Blob || !global.URL || typeof global.URL.createObjectURL !== 'function') return false;
      var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      var url = global.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      global.setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) {}
        try { global.URL.revokeObjectURL(url); } catch (e) {}
      }, 1500);
      return true;
    } catch (e) {
      PSWKT.logger.warn('export', 'Telechargement impossible', { message: e.message });
      return false;
    }
  }

  // Copie presse-papiers (asynchrone). Renvoie une Promise<boolean>.
  function copyToClipboard(content) {
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        return global.navigator.clipboard.writeText(content).then(function () { return true; },
          function () { return false; });
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(false);
  }

  PSWKT.exporter = {
    buildReport: buildReport,
    toJSON: toJSON,
    toText: toText,
    filename: filename,
    downloadText: downloadText,
    copyToClipboard: copyToClipboard
  };

})(typeof window !== 'undefined' ? window : this);
