/*
 * PSWKT - Application : interface et orchestration
 * Relie l'UI au harnais : selection, execution en direct, progression,
 * arret, journal et export. Vanilla JS, compatible WebKit ancien.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  // --- Helpers DOM ---
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!attrs.hasOwnProperty(k)) continue;
        if (k === 'class') e.className = attrs[k];
        else if (k === 'text') e.appendChild(document.createTextNode(attrs[k]));
        else if (k === 'html') e.innerHTML = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        if (children[i] != null) e.appendChild(children[i]);
      }
    }
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // --- Etat applicatif ---
  var state = {
    control: null,
    running: false,
    lastRun: null
  };

  // --- Rendu : environnement et fonctionnalites ---
  function renderEnvironment() {
    var rep = PSWKT.features.report();
    var env = rep.environment;

    var envBox = $('env-info');
    clear(envBox);
    var rows = [
      ['User-Agent', env.userAgent],
      ['Plateforme', env.platform],
      ['Langue', env.language],
      ['Coeurs logiques', env.hardwareConcurrency],
      ['Memoire (GB)', env.deviceMemoryGB],
      ['Ecran', env.screen.width + ' x ' + env.screen.height + ' @' + env.screen.pixelRatio],
      ['Fenetre', env.viewport.innerWidth + ' x ' + env.viewport.innerHeight]
    ];
    for (var i = 0; i < rows.length; i++) {
      envBox.appendChild(el('div', { class: 'kv' }, [
        el('span', { class: 'k', text: rows[i][0] }),
        el('span', { class: 'v', text: String(rows[i][1]) })
      ]));
    }

    var hint = $('ps-hint');
    clear(hint);
    if (rep.playstation.likelyPlaystation) {
      hint.appendChild(el('span', { class: 'badge badge-ps', text: 'PlayStation detectee' }));
      hint.appendChild(document.createTextNode(' ' + rep.playstation.hints.join(' ; ')));
    } else {
      hint.appendChild(el('span', { class: 'badge badge-neutral', text: 'PlayStation non detectee' }));
      hint.appendChild(document.createTextNode(' (indices absents du User-Agent)'));
    }

    // Grille de fonctionnalites
    var grid = $('feature-grid');
    clear(grid);
    var groups = rep.features;
    for (var groupName in groups) {
      if (!groups.hasOwnProperty(groupName)) continue;
      var g = groups[groupName];
      var card = el('div', { class: 'feat-group' }, [el('h4', { text: groupName })]);
      for (var fname in g) {
        if (!g.hasOwnProperty(fname)) continue;
        var ok = g[fname] === true;
        card.appendChild(el('div', { class: 'feat ' + (ok ? 'feat-on' : 'feat-off') }, [
          el('span', { class: 'dot' }),
          el('span', { class: 'feat-name', text: fname })
        ]));
      }
      grid.appendChild(card);
    }
  }

  // --- Rendu : categories et tests ---
  function renderCatalog() {
    var cats = R.listCategories();
    var container = $('categories');
    clear(container);

    for (var i = 0; i < cats.length; i++) {
      (function (cat) {
        var tests = R.listTests(cat.id);
        // Grandes categories (sondes) : pas de bouton par test ni d'affichage deplie,
        // pour eviter des milliers de noeuds DOM sur la console.
        var bulky = tests.length > 25;
        var body = el('div', { class: 'cat-tests' + (bulky ? ' collapsed' : '') });
        for (var j = 0; j < tests.length; j++) {
          (function (t) {
            var cb = el('input', { type: 'checkbox', id: 'cb-' + t.id, checked: 'checked' });
            cb.checked = true;
            cb.setAttribute('data-test', t.id);
            var row = el('label', { class: 'test-row', 'for': 'cb-' + t.id }, [
              cb,
              el('span', { class: 'test-name', text: t.name }),
              el('span', { class: 'test-desc', text: t.description })
            ]);
            var children = [row];
            if (!bulky) {
              var runBtn = el('button', { class: 'mini', type: 'button', text: 'Lancer', title: 'Lancer ce test seul' });
              runBtn.onclick = function (ev) {
                ev.preventDefault();
                if (!state.running) runTests([t], 'test « ' + t.name + ' »');
              };
              children.push(runBtn);
            }
            body.appendChild(el('div', { class: 'test-line' }, children));
          })(tests[j]);
        }

        var selectAll = el('button', { class: 'mini ghost', type: 'button', text: 'Tout cocher' });
        selectAll.onclick = function () { toggleCategory(cat.id, true); };
        var selectNone = el('button', { class: 'mini ghost', type: 'button', text: 'Tout decocher' });
        selectNone.onclick = function () { toggleCategory(cat.id, false); };
        var runCat = el('button', { class: 'mini primary', type: 'button', text: 'Lancer la categorie' });
        runCat.onclick = function () {
          if (!state.running) runTests(R.listTests(cat.id), 'categorie « ' + cat.label + ' »');
        };

        var actions = [selectAll, selectNone, runCat];
        if (bulky) {
          var toggle = el('button', { class: 'mini ghost', type: 'button', text: 'Afficher (' + tests.length + ')' });
          toggle.onclick = function () {
            var hidden = body.className.indexOf('collapsed') !== -1;
            body.className = 'cat-tests' + (hidden ? '' : ' collapsed');
            toggle.textContent = hidden ? 'Masquer' : ('Afficher (' + tests.length + ')');
          };
          actions.unshift(toggle);
        }

        var card = el('section', { class: 'cat-card', 'data-cat': cat.id }, [
          el('header', { class: 'cat-head' }, [
            el('div', {}, [
              el('h3', { text: cat.label }),
              el('p', { class: 'cat-desc', text: cat.description + ' (' + cat.count + ' tests)' })
            ]),
            el('div', { class: 'cat-actions' }, actions)
          ]),
          body
        ]);
        container.appendChild(card);
      })(cats[i]);
    }
  }

  function toggleCategory(catId, value) {
    var tests = R.listTests(catId);
    for (var i = 0; i < tests.length; i++) {
      var cb = $('cb-' + tests[i].id);
      if (cb) cb.checked = value;
    }
  }

  function getSelectedTests() {
    var all = R.listTests();
    var selected = [];
    for (var i = 0; i < all.length; i++) {
      var cb = $('cb-' + all[i].id);
      if (cb && cb.checked) selected.push(all[i]);
    }
    return selected;
  }

  // --- Lecture des reglages (garde-fous) ---
  function readOptions() {
    var timeout = parseInt($('opt-timeout').value, 10);
    var memMB = parseInt($('opt-memory').value, 10);
    var maxIter = parseInt($('opt-maxiter').value, 10);
    if (isNaN(timeout) || timeout < 100) timeout = PSWKT.guard.DEFAULTS.timeoutMs;
    if (isNaN(memMB) || memMB < 1) memMB = 64;
    if (isNaN(maxIter) || maxIter < 1000) maxIter = PSWKT.guard.DEFAULTS.maxIterations;
    return {
      timeoutMs: timeout,
      memoryBudgetBytes: memMB * 1024 * 1024,
      maxIterations: maxIter
    };
  }

  // --- Rendu : resultats et progression ---
  function resetResults() {
    clear($('results'));
    var sum = $('summary');
    clear(sum);
    setProgress(0, 1, 'pret');
  }

  function statusLabel(status) {
    var map = { pass: 'REUSSI', fail: 'ECHEC', skip: 'IGNORE', error: 'ERREUR', aborted: 'ARRETE' };
    return map[status] || status;
  }

  function appendResultRow(record) {
    var meas = record.measurements ? JSON.stringify(record.measurements) : '';
    var row = el('div', { class: 'result-row status-' + record.status }, [
      el('span', { class: 'result-status', text: statusLabel(record.status) }),
      el('div', { class: 'result-main' }, [
        el('div', { class: 'result-name', text: record.name + '  (' + record.durationMs + ' ms)' }),
        el('div', { class: 'result-detail', text: record.detail || '' }),
        meas ? el('div', { class: 'result-meas', text: meas }) : null,
        record.error ? el('div', { class: 'result-error', text: 'ERREUR ' + record.error.name + ': ' + record.error.message }) : null
      ])
    ]);
    $('results').appendChild(row);
  }

  function setProgress(done, total, label) {
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    $('progress-bar').style.width = pct + '%';
    $('progress-text').textContent = (label || '') + '  ' + done + ' / ' + total + '  (' + pct + '%)';
  }

  function renderSummary(summary) {
    var sum = $('summary');
    clear(sum);
    var c = summary.counts;
    var items = [
      ['total', summary.total, 'neutral'],
      ['reussis', c.pass, 'pass'],
      ['echecs', c.fail, 'fail'],
      ['erreurs', c.error, 'error'],
      ['ignores', c.skip, 'skip'],
      ['arretes', c.aborted, 'aborted']
    ];
    for (var i = 0; i < items.length; i++) {
      sum.appendChild(el('span', { class: 'chip chip-' + items[i][2] }, [
        el('b', { text: String(items[i][1]) }),
        el('span', { text: ' ' + items[i][0] })
      ]));
    }
    sum.appendChild(el('span', { class: 'chip chip-neutral', text: summary.totalDurationMs + ' ms total' }));
    if (summary.suiteAborted) sum.appendChild(el('span', { class: 'chip chip-aborted', text: 'SUITE INTERROMPUE' }));
  }

  // --- Execution ---
  function runTests(tests, label) {
    if (state.running) return;
    if (!tests || !tests.length) {
      logLine('warn', 'Aucun test selectionne.');
      return;
    }
    state.running = true;
    state.control = { aborted: false, currentBudget: null };
    resetResults();
    setRunningUI(true);

    var opts = readOptions();
    PSWKT.logger.info('app', 'Lancement : ' + label + ' (' + tests.length + ' tests)', opts);

    var runOptions = {
      timeoutMs: opts.timeoutMs,
      memoryBudgetBytes: opts.memoryBudgetBytes,
      maxIterations: opts.maxIterations,
      allowDestructive: false,
      control: state.control,
      onProgress: function (done, total, record) {
        appendResultRow(record);
        setProgress(done, total, 'execution');
      }
    };

    setProgress(0, tests.length, 'demarrage');

    R.runSuite(tests, runOptions).then(function (result) {
      state.lastRun = result;
      renderSummary(result.summary);
      setProgress(result.records.length, tests.length, result.summary.suiteAborted ? 'interrompu' : 'termine');
      PSWKT.logger.info('app', 'Termine : ' + label, result.summary);
      state.running = false;
      setRunningUI(false);
    }, function (err) {
      PSWKT.logger.captureGlobalError(err);
      state.running = false;
      setRunningUI(false);
    });
  }

  function stopRun() {
    if (!state.running || !state.control) return;
    state.control.aborted = true;
    if (state.control.currentBudget) {
      state.control.currentBudget.requestAbort('bouton Stop');
    }
    logLine('warn', 'Arret demande par l utilisateur.');
    $('progress-text').textContent = 'arret en cours...';
  }

  function setRunningUI(running) {
    $('btn-run-all').disabled = running;
    $('btn-run-selected').disabled = running;
    $('btn-stop').disabled = !running;
    var cards = document.querySelectorAll('.cat-card button');
    for (var i = 0; i < cards.length; i++) cards[i].disabled = running;
  }

  // --- Journal en direct ---
  var LOG_MAX_LINES = 400;
  function logLine(level, msg) {
    var cons = $('log-console');
    var line = el('div', { class: 'log-line log-' + level }, [
      el('span', { class: 'log-lvl', text: level.toUpperCase() }),
      el('span', { class: 'log-msg', text: msg })
    ]);
    cons.appendChild(line);
    while (cons.childNodes.length > LOG_MAX_LINES) cons.removeChild(cons.firstChild);
    var auto = $('opt-autoscroll');
    if (!auto || auto.checked) cons.scrollTop = cons.scrollHeight;
  }

  // Construit le journal complet en texte, l'affiche dans la zone et tente la copie.
  function copyLog() {
    var text = PSWKT.logger.toText();
    var area = $('log-copy-area');
    area.value = text;
    area.style.display = 'block';
    var n = PSWKT.logger.events.length;
    $('log-copy-hint').textContent = 'Journal : ' + n + ' lignes, ' + text.length + ' octets.';
    PSWKT.exporter.copyToClipboard(text).then(function (copied) {
      $('log-copy-hint').textContent = 'Journal : ' + n + ' lignes, ' + text.length + ' octets. ' +
        (copied ? 'Copie dans le presse-papiers.' : 'Selectionnez le texte ci-dessous pour le copier (Ctrl/Cmd+A puis Ctrl/Cmd+C).');
    });
    try { area.focus(); area.select(); } catch (e) {}
  }

  function downloadLog() {
    var text = PSWKT.logger.toText();
    var name = PSWKT.exporter.filename('log.txt');
    var ok = PSWKT.exporter.downloadText(text, name, 'text/plain;charset=utf-8');
    var area = $('log-copy-area');
    area.value = text;
    area.style.display = 'block';
    $('log-copy-hint').textContent = ok ? ('Telechargement declenche (' + name + ').') :
      'Telechargement indisponible : selectionnez la zone ci-dessous pour copier le journal.';
  }

  function wireLogger() {
    PSWKT.logger.subscribe(function (payload) {
      if (payload.type === 'event') {
        var e = payload.entry;
        logLine(e.level, '[' + e.source + '] ' + e.msg);
      } else if (payload.type === 'reset') {
        clear($('log-console'));
      }
    });
  }

  // --- Export ---
  function doExport(kind) {
    var report = PSWKT.exporter.buildReport(state.lastRun);
    var content, name, mime;
    if (kind === 'text') {
      content = PSWKT.exporter.toText(report);
      name = PSWKT.exporter.filename('txt');
      mime = 'text/plain;charset=utf-8';
    } else {
      content = PSWKT.exporter.toJSON(report);
      name = PSWKT.exporter.filename('json');
      mime = 'application/json;charset=utf-8';
    }
    // 1) zone de texte selectionnable (toujours dispo, meme sur console)
    var area = $('export-area');
    area.value = content;
    area.style.display = 'block';
    $('export-hint').textContent = 'Rapport pret (' + content.length + ' octets). ' +
      'Selectionnez tout le texte ci-dessous pour le copier, ou utilisez les boutons.';
    // 2) tentative de telechargement
    var dl = PSWKT.exporter.downloadText(content, name, mime);
    // 3) tentative de copie presse-papiers
    PSWKT.exporter.copyToClipboard(content).then(function (copied) {
      var parts = [];
      if (dl) parts.push('telechargement declenche (' + name + ')');
      if (copied) parts.push('copie dans le presse-papiers');
      if (parts.length) $('export-hint').textContent += '  [' + parts.join(' ; ') + ']';
    });
    PSWKT.logger.info('app', 'Export ' + kind + ' genere (' + content.length + ' octets)');
  }

  function selectExportArea() {
    var area = $('export-area');
    area.style.display = 'block';
    area.focus();
    try { area.select(); } catch (e) {}
  }

  // --- Initialisation ---
  function init() {
    renderEnvironment();
    renderCatalog();
    wireLogger();

    $('btn-run-all').onclick = function () {
      runTests(R.listTests(), 'tous les tests');
    };
    $('btn-run-selected').onclick = function () {
      runTests(getSelectedTests(), 'selection');
    };
    $('btn-stop').onclick = stopRun;
    $('btn-export-json').onclick = function () { doExport('json'); };
    $('btn-export-text').onclick = function () { doExport('text'); };
    $('btn-select-export').onclick = selectExportArea;
    $('btn-clear-log').onclick = function () { clear($('log-console')); };
    $('btn-copy-log').onclick = copyLog;
    $('btn-download-log').onclick = downloadLog;

    setRunningUI(false);
    PSWKT.logger.info('app', 'Interface prete. ' + R.listTests().length + ' tests dans ' +
      R.listCategories().length + ' categories.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
