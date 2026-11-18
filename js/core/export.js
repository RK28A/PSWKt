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

  var VERDICT = {
    pass: 'REUSSI   — le moteur a execute l operation et renvoye un resultat COHERENT.',
    fail: 'ECHEC    — le moteur a renvoye un resultat INCOHERENT (un invariant est viole).',
    error: 'ERREUR   — le moteur a leve une EXCEPTION NON PREVUE pendant le test.',
    aborted: 'ARRETE   — interrompu par l echeance ou le bouton Stop (operation trop longue / figee).',
    skip: 'IGNORE   — test non execute (prerequis absent ou mode agressif desactive).'
  };

  // Rend un evenement de journal en une ligne lisible, en qualifiant son role.
  function eventLine(e) {
    var role = e.level === 'info' ? 'ACTION ' :
      (e.level === 'metric' ? 'REACTION' :
      (e.level === 'error' ? 'ERREUR ' :
      (e.level === 'warn' ? 'ALERTE ' :
      (e.level === 'pass' ? 'FIN-OK ' : (e.level === 'fail' ? 'FIN-KO ' : (e.level || '').toUpperCase())))));
    var t = ('        ' + (e.t != null ? e.t.toFixed(3) : '?')).slice(-9);
    var s = '      · [' + t + 'ms] ' + role + ' ' + e.msg;
    if (e.data !== undefined) { try { s += '  →  ' + JSON.stringify(e.data); } catch (x) {} }
    return s;
  }

  // Bloc texte ULTRA-DETAILLE pour un seul resultat. Structure volontairement
  // explicite : ce que le test a TENTE (action), ce qu'il a FAIT etape par etape
  // (deroule), et COMMENT LA MACHINE A REAGI (verdict + mesures + erreur + memoire).
  // `events` (optionnel) = les evenements de journal emis par CE test.
  function recordBlock(r, annotation, events) {
    var L = [];
    function line(s) { L.push(s == null ? '' : String(s)); }
    line('════════════════════════════════════════════════════════════════');
    line('TEST : ' + r.name + (r.destructive ? '   ⚠ DESTRUCTIF' : ''));
    line('  id        : ' + r.id + '   |   categorie : ' + r.category + '   |   duree : ' + r.durationMs + ' ms');
    if (r.description) line('▸ ACTION (but du test) : ' + r.description);

    // Deroule pas-a-pas : chaque sous-etape (action) et chaque mesure (reaction).
    if (events && events.length) {
      line('▸ DEROULE (ce que le test a fait, et comment le moteur a repondu) :');
      for (var i = 0; i < events.length; i++) line(eventLine(events[i]));
    }

    // Verdict en clair : comment la machine a reagi.
    line('▸ REACTION DU MOTEUR : ' + (VERDICT[r.status] || (r.status || '?').toUpperCase()));
    if (r.detail) line('    resume   : ' + r.detail);

    if (r.measurements) {
      var mj;
      try { mj = JSON.stringify(r.measurements, null, 2); } catch (e) { mj = '[mesures illisibles]'; }
      line('    mesures detaillees :');
      var ml = mj.split('\n');
      for (var a = 0; a < ml.length; a++) line('        ' + ml[a]);
    }
    if (r.error) {
      line('    EXCEPTION : ' + r.error.name + ': ' + r.error.message);
      if (r.error.stack) {
        line('    pile d appels :');
        var sl = String(r.error.stack).split('\n');
        for (var b = 0; b < sl.length; b++) line('        ' + sl[b]);
      }
    }
    if (r.heap && (r.heap.before || r.heap.after)) {
      var hb = r.heap.before ? Math.round(r.heap.before.usedJSHeapSize / 1048576 * 100) / 100 : null;
      var ha = r.heap.after ? Math.round(r.heap.after.usedJSHeapSize / 1048576 * 100) / 100 : null;
      var delta = (hb != null && ha != null) ? (Math.round((ha - hb) * 100) / 100) : null;
      line('    tas JS (Mo) : avant ' + (hb == null ? '?' : hb) + ' → apres ' + (ha == null ? '?' : ha) +
        (delta != null ? ('   (Δ ' + (delta >= 0 ? '+' : '') + delta + ' Mo)') : ''));
    }
    if (r.budget) {
      line('    budget : ' + r.budget.iterations + ' iterations, ' +
        Math.round((r.budget.allocatedBytes || 0) / 1048576 * 100) / 100 + ' Mo charges, echeance ' +
        r.budget.timeoutMs + ' ms' + (r.budget.aborted ? (' [ARRETE: ' + r.budget.abortReason + ']') : ''));
    }
    if (annotation && (annotation.tag || annotation.note)) {
      line('▸ ANNOTATION (toi) : ' + (annotation.tag ? ('[' + annotation.tag + '] ') : '') + (annotation.note || ''));
    }
    return L.join('\n');
  }

  // Regroupe les evenements du journal par test (source = id du test).
  function groupEventsBySource(events) {
    var map = {};
    for (var i = 0; i < events.length; i++) {
      var s = events[i].source;
      if (!map[s]) map[s] = [];
      map[s].push(events[i]);
    }
    return map;
  }

  // Rapport texte ULTRA-DETAILLE complet (environnement + resume + chaque test + journal).
  function toDetailedText(report) {
    var L = [];
    function line(s) { L.push(s == null ? '' : String(s)); }
    line('================================================================');
    line('   PSWKT - RAPPORT ULTRA-DETAILLE');
    line('================================================================');
    line('Genere : ' + report.meta.generatedAt);
    line('URL    : ' + report.meta.href);
    line('UA     : ' + report.environment.userAgent);
    line('Plateforme : ' + report.environment.platform + '  |  coeurs : ' + report.environment.hardwareConcurrency +
      '  |  memoire GB : ' + report.environment.deviceMemoryGB);
    line('Ecran  : ' + report.environment.screen.width + 'x' + report.environment.screen.height +
      ' @' + report.environment.screen.pixelRatio);
    line('PlayStation probable : ' + report.playstation.likelyPlaystation +
      (report.playstation.hints.length ? (' (' + report.playstation.hints.join('; ') + ')') : ''));
    line('');

    if (report.run && report.run.summary) {
      var s = report.run.summary;
      line('--- RESUME ---');
      line('Total ' + s.total + '  |  reussis ' + s.counts.pass + '  echecs ' + s.counts.fail +
        '  erreurs ' + s.counts.error + '  ignores ' + s.counts.skip + '  arretes ' + s.counts.aborted);
      line('Duree totale : ' + s.totalDurationMs + ' ms' + (s.suiteAborted ? '  (SUITE INTERROMPUE)' : ''));
      line('');
      line('--- DETAIL ULTRA-COMPLET, TEST PAR TEST (action → deroule → reaction) ---');
      var byTest = groupEventsBySource(report.log.events);
      for (var i = 0; i < report.run.records.length; i++) {
        var r = report.run.records[i];
        line(recordBlock(r, report.annotations.items[r.id], byTest[r.id]));
      }
      line('');
    }

    if (report.log.globalErrors.length) {
      line('--- ERREURS JS GLOBALES (' + report.log.globalErrors.length + ') ---');
      for (var k = 0; k < report.log.globalErrors.length; k++) {
        var ge = report.log.globalErrors[k];
        line('(' + ge.t + ' ms) ' + ge.name + ': ' + ge.message + (ge.source ? ('  @' + ge.source) : ''));
        if (ge.stack) {
          var gsl = String(ge.stack).split('\n');
          for (var g = 0; g < gsl.length; g++) line('      ' + gsl[g]);
        }
      }
      line('');
    }

    // Journal des evenements HORS test (app, systeme) : le reste est deja detaille
    // test par test ci-dessus, inutile de tout redupliquer.
    var recIds = {};
    if (report.run && report.run.records) {
      for (var ri = 0; ri < report.run.records.length; ri++) recIds[report.run.records[ri].id] = true;
    }
    var other = [];
    for (var j = 0; j < report.log.events.length; j++) {
      if (!recIds[report.log.events[j].source]) other.push(report.log.events[j]);
    }
    if (other.length) {
      line('--- JOURNAL GENERAL (evenements hors test : ' + other.length + ') ---');
      for (var o = 0; o < other.length; o++) {
        var e = other[o];
        var t = ('            ' + (e.t != null ? e.t.toFixed(3) : '?')).slice(-12);
        var lvl = ((e.level || '').toUpperCase() + '       ').slice(0, 7);
        var el = '[' + t + 'ms] ' + lvl + ' [' + e.source + '] ' + e.msg;
        if (e.data !== undefined) { try { el += ' | ' + JSON.stringify(e.data); } catch (x) {} }
        line(el);
      }
    }
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
    toDetailedText: toDetailedText,
    recordBlock: recordBlock,
    filename: filename,
    downloadText: downloadText,
    copyToClipboard: copyToClipboard
  };

})(typeof window !== 'undefined' ? window : this);
