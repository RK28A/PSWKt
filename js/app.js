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

  // --- Application state ---
  var state = {
    control: null,
    running: false,
    lastRun: null,
    session: null,
    compareSel: {}
  };

  // --- Tab navigation (single page, real tabs) ---
  function switchTab(name) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i].getAttribute('data-tab') === name;
      tabs[i].className = 'tab' + (active ? ' is-active' : '');
      tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    var panels = document.querySelectorAll('.tabpanel');
    for (var j = 0; j < panels.length; j++) {
      var show = panels[j].id === 'panel-' + name;
      if (show) { panels[j].hidden = false; panels[j].className = 'tabpanel is-active'; }
      else { panels[j].hidden = true; panels[j].className = 'tabpanel'; }
    }
    try { if (window.scrollTo) window.scrollTo(0, 0); } catch (e) {}
  }

  // --- Rendu: environment + features (tolerant to missing elements) ---
  function renderEnvironment() {
    var rep = PSWKT.features.report();
    var env = rep.environment;

    var envBox = $('env-info');
    if (envBox) {
      clear(envBox);
      var rows = [
        ['User-Agent', env.userAgent],
        ['Platform', env.platform],
        ['Language', env.language],
        ['Logical cores', env.hardwareConcurrency],
        ['Memory (GB)', env.deviceMemoryGB],
        ['Screen', env.screen.width + ' x ' + env.screen.height + ' @' + env.screen.pixelRatio],
        ['Window', env.viewport.innerWidth + ' x ' + env.viewport.innerHeight]
      ];
      for (var i = 0; i < rows.length; i++) {
        envBox.appendChild(el('div', { class: 'kv' }, [
          el('span', { class: 'k', text: rows[i][0] }),
          el('span', { class: 'v', text: String(rows[i][1]) })
        ]));
      }
    }

    var nTests = R.listTests().length, nCats = R.listCategories().length;
    var hint = $('ps-hint');
    if (hint) {
      clear(hint);
      if (rep.playstation.likelyPlaystation) {
        hint.appendChild(el('span', { class: 'badge badge-ps', text: 'PlayStation detected' }));
      } else {
        hint.appendChild(el('span', { class: 'badge badge-neutral', text: 'PlayStation not detected' }));
      }
      hint.appendChild(el('span', { class: 'env-ua', text: '  ' + env.platform + ' · ' + nTests + ' tests / ' + nCats + ' categories' }));
    }
    var stats = $('brand-stats');
    if (stats) stats.textContent = nTests + ' tests · ' + nCats + ' categories';

    var grid = $('feature-grid');
    if (grid) {
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
  }

  // --- Categories & tests (collapsible, collapsed by default, lazy bodies) ---
  // Bodies are built only when a category is first expanded: keeps the initial
  // DOM tiny (just headers), which matters a lot on the PS5 browser.
  function buildCatBody(cat, body) {
    if (body.getAttribute('data-built')) return;
    var tests = R.listTests(cat.id);
    var bulky = tests.length > 25; // for huge probe lists, skip per-test run buttons
    var actions = el('div', { class: 'cat-actions' }, [
      mkMini('Check all', function () { toggleCategory(cat.id, true); }),
      mkMini('Uncheck all', function () { toggleCategory(cat.id, false); }),
      (function () { var b = el('button', { class: 'btn mini primary', type: 'button', text: 'Run category' }); b.onclick = function () { if (!state.running) runTests(R.listTests(cat.id), 'category: ' + cat.label); }; return b; })()
    ]);
    body.appendChild(actions);
    var list = el('div', { class: 'cat-list' });
    for (var j = 0; j < tests.length; j++) {
      (function (t) {
        var cb = el('input', { type: 'checkbox', id: 'cb-' + t.id });
        cb.checked = true; cb.setAttribute('data-test', t.id);
        var row = el('label', { class: 'test-row', 'for': 'cb-' + t.id }, [
          cb,
          el('span', { class: 'test-name', text: t.name + (t.destructive ? ' ⚠' : '') }),
          el('span', { class: 'test-desc', text: t.description || '' })
        ]);
        var children = [row];
        if (!bulky) {
          var runBtn = el('button', { class: 'btn mini', type: 'button', text: 'Run', title: 'Run this test alone' });
          runBtn.onclick = function (ev) { ev.preventDefault(); if (!state.running) runTests([t], 'test: ' + t.name); };
          children.push(runBtn);
        }
        list.appendChild(el('div', { class: 'test-line' }, children));
      })(tests[j]);
    }
    body.appendChild(list);
    body.setAttribute('data-built', '1');
  }

  function renderCatalog() {
    var container = $('categories');
    if (!container) return;
    var cats = R.listCategories();
    clear(container);
    for (var i = 0; i < cats.length; i++) {
      (function (cat) {
        var body = el('div', { class: 'cat-tests collapsed' });
        var head = el('button', { class: 'cat-head', type: 'button' }, [
          el('span', { class: 'cat-caret', text: '▶' }),
          el('span', { class: 'cat-title' }, [
            el('h3', { text: cat.label + (/aggressive|agressif|AGRESSIF/.test(cat.label) ? '' : '') }),
            el('p', { class: 'cat-desc', text: cat.description || '' })
          ]),
          el('span', { class: 'cat-count', text: cat.count + ' tests' })
        ]);
        var card = el('section', { class: 'cat-card', 'data-cat': cat.id }, [head, body]);
        head.onclick = function () {
          var open = card.className.indexOf('open') === -1;
          if (open) buildCatBody(cat, body);
          card.className = 'cat-card' + (open ? ' open' : '');
          body.className = 'cat-tests' + (open ? '' : ' collapsed');
        };
        container.appendChild(card);
      })(cats[i]);
    }
  }
  function setAllCategoriesOpen(open) {
    var cards = document.querySelectorAll('#categories .cat-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i], body = card.querySelector('.cat-tests');
      if (open) { var catId = card.getAttribute('data-cat'); buildCatBody({ id: catId, label: catId }, body); }
      card.className = 'cat-card' + (open ? ' open' : '');
      if (body) body.className = 'cat-tests' + (open ? '' : ' collapsed');
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

  function setAllChecks(value) {
    var all = R.listTests();
    for (var i = 0; i < all.length; i++) { var cb = $('cb-' + all[i].id); if (cb) cb.checked = value; }
  }

  // --- Aggressive/destructive test list (dashboard) ---
  function destructiveTests() {
    return R.listTests().filter(function (t) { return t.destructive; });
  }
  function renderAggressiveList() {
    var box = $('aggressive-list');
    if (!box || box.getAttribute('data-filled')) return;
    var tests = destructiveTests();
    clear(box);
    box.appendChild(el('p', { class: 'muted small', text:
      '⚠ These tests may freeze or crash the browser (the console then restarts). Tick only the ones you want to run — all unchecked by default.' }));
    var tools = el('div', { class: 'aggr-tools' }, [
      mkMini('Check all', function () { setAggrChecks(true); }),
      mkMini('Uncheck all', function () { setAggrChecks(false); })
    ]);
    box.appendChild(tools);
    for (var i = 0; i < tests.length; i++) {
      (function (t) {
        var cb = el('input', { type: 'checkbox', id: 'aggr-cb-' + t.id });
        var row = el('label', { class: 'aggr-row', 'for': 'aggr-cb-' + t.id }, [
          cb,
          el('span', { class: 'aggr-name', text: t.name }),
          el('span', { class: 'aggr-cat', text: t.category })
        ]);
        box.appendChild(row);
      })(tests[i]);
    }
    box.setAttribute('data-filled', '1');
  }
  function setAggrChecks(value) {
    var tests = destructiveTests();
    for (var i = 0; i < tests.length; i++) { var cb = $('aggr-cb-' + tests[i].id); if (cb) cb.checked = value; }
  }
  function updateAggressiveListVisibility() {
    var box = $('aggressive-list');
    if (!box) return;
    var on = $('opt-aggressive') && $('opt-aggressive').checked;
    if (on) { renderAggressiveList(); box.style.display = ''; } else { box.style.display = 'none'; }
    // Make the main button say exactly what it will run in each mode.
    var btn = $('btn-run-all');
    if (btn) btn.innerHTML = on ? '▶&nbsp; Run checked aggressive' : '▶&nbsp; Run all tests';
  }
  // What "Run all tests" runs from the Dashboard:
  //  - aggressive mode OFF: every non-destructive test (the full diagnostic).
  //  - aggressive mode ON : ONLY the aggressive tests you ticked (nothing else).
  function collectHomeRunTests() {
    var all = R.listTests();
    var on = $('opt-aggressive') && $('opt-aggressive').checked;
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var t = all[i];
      if (on) { if (t.destructive) { var cb = $('aggr-cb-' + t.id); if (cb && cb.checked) out.push(t); } }
      else if (!t.destructive) out.push(t);
    }
    return out;
  }

  // --- Lecture des reglages (garde-fous) ---
  function readOptions() {
    var timeout = parseInt($('opt-timeout').value, 10);
    var memMB = parseInt($('opt-memory').value, 10);
    var maxIter = parseInt($('opt-maxiter').value, 10);
    if (isNaN(timeout) || timeout < 100) timeout = PSWKT.guard.DEFAULTS.timeoutMs;
    if (isNaN(memMB) || memMB < 1) memMB = 64;
    if (isNaN(maxIter) || maxIter < 1000) maxIter = PSWKT.guard.DEFAULTS.maxIterations;
    var aggressive = $('opt-aggressive') ? $('opt-aggressive').checked : true;
    var streaming = $('opt-stream') ? $('opt-stream').checked : false;
    return {
      timeoutMs: timeout,
      memoryBudgetBytes: memMB * 1024 * 1024,
      maxIterations: maxIter,
      allowDestructive: aggressive,
      streaming: streaming
    };
  }

  // --- Rendu : resultats et progression ---
  function resetResults() {
    if ($('results')) clear($('results'));
    if ($('summary')) clear($('summary'));
    setProgress(0, 1, 'ready');
  }

  function statusLabel(status) {
    var map = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP', error: 'ERROR', aborted: 'ABORTED' };
    return map[status] || status;
  }

  // Barre d'annotation par resultat : etiquette rapide + note libre, incluse dans l'export.
  var ANNOT_TAGS = ['OK', 'Slow', 'Froze', 'Reloaded', 'Other'];
  function buildAnnotationBar(testId, testName) {
    var current = PSWKT.annotations[testId] || { tag: '', note: '' };
    var bar = el('div', { class: 'annot' });
    var btns = [];
    for (var i = 0; i < ANNOT_TAGS.length; i++) {
      (function (tag) {
        var b = el('button', { type: 'button', class: 'tag' + (current.tag === tag ? ' tag-on' : ''), text: tag });
        b.onclick = function (ev) {
          ev.preventDefault();
          var a = PSWKT.annotations[testId] || { tag: '', note: '' };
          a.tag = (a.tag === tag) ? '' : tag;
          a.name = testName;
          PSWKT.annotations[testId] = a;
          for (var j = 0; j < btns.length; j++) {
            btns[j].className = 'tag' + (a.tag === ANNOT_TAGS[j] ? ' tag-on' : '');
          }
        };
        btns.push(b);
        bar.appendChild(b);
      })(ANNOT_TAGS[i]);
    }
    var note = el('input', { type: 'text', class: 'annot-note' });
    note.setAttribute('placeholder', 'free note (e.g. reloaded the browser)...');
    note.value = current.note || '';
    note.oninput = function () {
      var a = PSWKT.annotations[testId] || { tag: '', note: '' };
      a.note = note.value;
      a.name = testName;
      PSWKT.annotations[testId] = a;
    };
    bar.appendChild(note);
    return bar;
  }

  function classifOf(record) {
    return record.classification || (PSWKT.runner.classify ? PSWKT.runner.classify(record.status, record.detail) : { code: record.status, label: record.status });
  }
  function appendResultRow(record) {
    var meas = record.measurements ? JSON.stringify(record.measurements) : '';
    var cl = classifOf(record);
    // Lazy annotation: build the (heavy) tag bar only when the user asks for it.
    // Keeps big runs (hundreds/thousands of rows) light and responsive.
    var annotSlot = el('div', { class: 'annot-slot' });
    var annotBtn = el('button', { class: 'btn mini ghost annot-open', type: 'button', text: '✎ note' });
    annotBtn.onclick = function () { annotSlot.removeChild(annotBtn); annotSlot.appendChild(buildAnnotationBar(record.id, record.name)); };
    annotSlot.appendChild(annotBtn);
    var row = el('div', { class: 'result-row status-' + record.status }, [
      el('span', { class: 'result-status', text: statusLabel(record.status) }),
      el('div', { class: 'result-main' }, [
        el('div', { class: 'result-name', text: record.name + '  (' + record.durationMs + ' ms)' }),
        el('div', { class: 'result-class class-' + cl.code, text: '→ ' + cl.label }),
        el('div', { class: 'result-detail', text: record.detail || '' }),
        meas ? el('div', { class: 'result-meas', text: meas }) : null,
        record.error ? el('div', { class: 'result-error', text: 'ERROR ' + record.error.name + ': ' + record.error.message }) : null,
        annotSlot
      ])
    ]);
    row.setAttribute('data-status', record.status);
    row.setAttribute('data-text', (record.name + ' ' + record.id + ' ' + (record.detail || '') + ' ' + record.category).toLowerCase());
    applyFilterToRow(row);
    $('results').appendChild(row);
    // NOTE: updateFilterCount() is intentionally NOT called here (it scans every
    // row, which would be O(n^2) across a run). It is refreshed once when the run
    // finishes and whenever the filter changes.
  }

  // --- Recherche / filtre des resultats ---
  function currentFilter() {
    return {
      q: ($('result-search') ? $('result-search').value : '').toLowerCase().trim(),
      pass: !$('filter-pass') || $('filter-pass').checked,
      fail: !$('filter-fail') || $('filter-fail').checked,
      error: !$('filter-error') || $('filter-error').checked,
      aborted: !$('filter-aborted') || $('filter-aborted').checked,
      skip: $('filter-skip') && $('filter-skip').checked
    };
  }
  function rowMatches(row, f) {
    var st = row.getAttribute('data-status');
    if (f[st] === false) return false;
    if (f.q && row.getAttribute('data-text').indexOf(f.q) === -1) return false;
    return true;
  }
  function applyFilterToRow(row, f) {
    f = f || currentFilter();
    row.style.display = rowMatches(row, f) ? '' : 'none';
  }
  function applyResultFilter() {
    if (!$('results')) return;
    var f = currentFilter();
    var rows = $('results').childNodes;
    for (var i = 0; i < rows.length; i++) { if (rows[i].nodeType === 1) applyFilterToRow(rows[i], f); }
    updateFilterCount();
  }
  function updateFilterCount() {
    var el2 = $('filter-count'); if (!el2 || !$('results')) return;
    var rows = $('results').childNodes, shown = 0, total = 0;
    for (var i = 0; i < rows.length; i++) { if (rows[i].nodeType === 1) { total++; if (rows[i].style.display !== 'none') shown++; } }
    el2.textContent = shown + ' / ' + total + ' shown';
  }

  function setProgress(done, total, label) {
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    if ($('progress-bar')) $('progress-bar').style.width = pct + '%';
    if ($('progress-text')) $('progress-text').textContent = (label || '') + '  ' + done + ' / ' + total + '  (' + pct + '%)';
  }

  function renderSummary(summary) {
    var sum = $('summary');
    if (!sum) return;
    clear(sum);
    var c = summary.counts;
    var items = [
      ['total', summary.total, 'neutral'],
      ['passed', c.pass, 'pass'],
      ['failed', c.fail, 'fail'],
      ['errors', c.error, 'error'],
      ['skipped', c.skip, 'skip'],
      ['aborted', c.aborted, 'aborted']
    ];
    for (var i = 0; i < items.length; i++) {
      sum.appendChild(el('span', { class: 'chip chip-' + items[i][2] }, [
        el('b', { text: String(items[i][1]) }),
        el('span', { text: ' ' + items[i][0] })
      ]));
    }
    sum.appendChild(el('span', { class: 'chip chip-neutral', text: summary.totalDurationMs + ' ms total' }));
    if (summary.suiteAborted) sum.appendChild(el('span', { class: 'chip chip-aborted', text: 'SUITE INTERRUPTED' }));

    // Repartition par CLASSIFICATION (distingue incompatible / exception / incorrect / plantage...)
    if (state.lastRun && state.lastRun.records && state.lastRun.records.length) {
      var byCl = {};
      for (var i = 0; i < state.lastRun.records.length; i++) {
        var c = classifOf(state.lastRun.records[i]);
        if (!byCl[c.code]) byCl[c.code] = { label: c.label, n: 0 };
        byCl[c.code].n++;
      }
      var line = el('div', { class: 'classif-line' });
      for (var code in byCl) {
        if (!byCl.hasOwnProperty(code)) continue;
        line.appendChild(el('span', { class: 'classif-chip class-' + code, text: byCl[code].label + ' : ' + byCl[code].n }));
      }
      sum.appendChild(line);
    }
  }

  // --- Execution ---
  function runTests(tests, label) {
    if (state.running) return;
    if (!tests || !tests.length) {
      logLine('warn', 'No test selected.');
      return;
    }
    switchTab('dashboard'); // surface progress, results and console
    state.running = true;
    state.control = { aborted: false, currentBudget: null };
    resetResults();
    setRunningUI(true);

    var opts = readOptions();
    // A NEW RUN = A FRESH LOG: start from a clean log (the previous one is already
    // persisted in the IndexedDB history) and a brand new session.
    PSWKT.logger.reset();
    if ($('stream-hint')) $('stream-hint').textContent = '';
    PSWKT.logger.info('app', 'Launch: ' + label + ' (' + tests.length + ' tests)', opts);

    // Nouvelle session locale (IndexedDB) : creee AVANT de lancer (voir plus bas),
    // pour que meme un run tres rapide soit enregistre et que le marqueur "en cours"
    // du 1er test existe deja.
    state.session = null;
    var mode = opts.allowDestructive ? 'stress' : 'diagnostic';

    // Enregistrement continu : ouvre une session serveur (fichier dedie, tronque).
    var streaming = false;
    if (opts.streaming && PSWKT.serverLog) {
      var slug = String(label).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
      var stamp = PSWKT.exporter.filename('txt').replace(/^pswkt-rapport-/, '').replace(/\.txt$/, '');
      var session = stamp + (slug ? ('-' + slug) : '');
      var ok = PSWKT.serverLog.enable(session);
      streaming = true;
      var sh = $('stream-hint');
      if (sh) {
        if (ok) sh.textContent = 'Continuous logging active -> logs/pswkt-live-' + session + '.txt (written as it goes).';
        else sh.textContent = 'Continuous logging: server endpoint unreachable (' + (PSWKT.serverLog.lastError || '?') + '). Needs api/log-stream.php on a PHP host.';
      }
      PSWKT.logger.info('app', 'Continuous logging: session ' + session + (ok ? ' (OK)' : ' (SERVER UNREACHABLE)'));
    }

    var runOptions = {
      timeoutMs: opts.timeoutMs,
      memoryBudgetBytes: opts.memoryBudgetBytes,
      maxIterations: opts.maxIterations,
      allowDestructive: opts.allowDestructive,
      control: state.control,
      // Marqueur AVANT l'execution du test. (1) IndexedDB : trace locale du test en
      // cours -> si WebKit plante, au rechargement la session reste "running" et ce
      // marqueur nomme le test fautif. (2) Serveur (si actif) : ligne persistee sur disque.
      onTestStart: function (test, idx, total) {
        var p = null;
        if (state.session && PSWKT.store) {
          var mark = { id: test.id, name: test.name, idx: idx + 1, total: total, destructive: !!test.destructive };
          p = PSWKT.store.markRunning(state.session.id, mark);
        }
        if (streaming) {
          PSWKT.serverLog.marker('▶ DEBUT  [' + (idx + 1) + '/' + total + ']  ' + test.id + '  —  ' + test.name +
            (test.destructive ? '   ⚠ DESTRUCTIF' : ''), true);
        }
        // Pour un test DESTRUCTIF (risque de plantage), on renvoie la Promise :
        // le runner attend que l'ecriture IndexedDB soit confirmee avant de lancer
        // le test, pour que la trace du test fautif survive au crash.
        return test.destructive ? p : null;
      },
      // ctx.flush() des tests agressifs : persiste les jalons avant l'etape risquee.
      onFlush: streaming ? function () { return PSWKT.serverLog.flush(true); } : undefined,
      onProgress: function (done, total, record) {
        appendResultRow(record);
        setProgress(done, total, 'running');
        // Persistance locale du resultat complet (efface le marqueur "en cours").
        if (state.session && PSWKT.store) {
          try { PSWKT.store.saveRecord(state.session.id, record); } catch (e) {}
        }
        if (streaming) {
          try { PSWKT.serverLog.raw(PSWKT.exporter.recordBlock(record, (PSWKT.annotations || {})[record.id]), false); } catch (e) {}
          PSWKT.serverLog.marker('■ FIN    [' + done + '/' + total + ']  ' + record.id + '  ->  ' + String(record.status).toUpperCase(), false);
        }
      }
    };

    setProgress(0, tests.length, 'starting');

    // Launch the suite ONCE the local session exists (otherwise a very fast run
    // would finish before it is recorded). If storage fails, run anyway.
    function launch() { R.runSuite(tests, runOptions).then(onDone, onFail); }
    if (PSWKT.store) {
      PSWKT.store.createSession({ label: label, mode: mode }).then(function (sess) {
        state.session = sess;
        PSWKT.logger.info('app', 'Local session ' + sess.id + ' (' + PSWKT.store.kind + ')');
        launch();
      }, function () { launch(); });
    } else { launch(); }

    function onDone(result) {
      state.lastRun = result;
      renderSummary(result.summary);
      updateFilterCount();
      setProgress(result.records.length, tests.length, result.summary.suiteAborted ? 'interrupted' : 'done');
      PSWKT.logger.info('app', 'Done: ' + label, result.summary);
      // Close the local session and refresh the history.
      if (state.session && PSWKT.store) {
        PSWKT.store.finishSession(state.session.id, result.summary, result.summary.suiteAborted).then(function () { renderHistory(); });
      }
      if (streaming) {
        PSWKT.serverLog.marker('======== SUITE DONE: ' + result.summary.counts.pass + ' passed, ' +
          result.summary.counts.fail + ' failed, ' + result.summary.counts.error + ' errors, ' +
          result.summary.counts.aborted + ' aborted, ' + result.summary.counts.skip + ' skipped ========', true);
        PSWKT.serverLog.disable();
        var sh2 = $('stream-hint');
        if (sh2 && !PSWKT.serverLog.lastError) sh2.textContent += '  [done, ' + PSWKT.serverLog.bytesSent + ' bytes written]';
      }
      state.running = false;
      setRunningUI(false);
    }
    function onFail(err) {
      PSWKT.logger.captureGlobalError(err);
      if (state.session && PSWKT.store) { try { PSWKT.store.finishSession(state.session.id, state.lastRun && state.lastRun.summary, true).then(renderHistory); } catch (e) {} }
      if (streaming) { try { PSWKT.serverLog.marker('x SUITE INTERRUPTED BY AN ERROR: ' + (err && err.message), true); PSWKT.serverLog.disable(); } catch (e) {} }
      state.running = false;
      setRunningUI(false);
    }
  }

  function stopRun() {
    if (!state.running || !state.control) return;
    state.control.aborted = true;
    if (state.control.currentBudget) {
      state.control.currentBudget.requestAbort('Stop button');
    }
    logLine('warn', 'Stop requested by the user.');
    if ($('progress-text')) $('progress-text').textContent = 'stopping...';
  }

  function setRunningUI(running) {
    var ids = ['btn-run-all', 'btn-run-selected'];
    for (var k = 0; k < ids.length; k++) { if ($(ids[k])) $(ids[k]).disabled = running; }
    if ($('btn-stop')) $('btn-stop').disabled = !running;
    if ($('btn-stop-2')) $('btn-stop-2').disabled = !running;
    try { document.body.className = running ? 'running' : ''; } catch (e) {}
    var cards = document.querySelectorAll('.cat-head, .cat-actions button');
    for (var i = 0; i < cards.length; i++) cards[i].disabled = running;
  }

  // --- Journal en direct ---
  var LOG_MAX_LINES = 400;
  function logLine(level, msg) {
    var cons = $('log-console');
    if (!cons) return;
    var line = el('div', { class: 'log-line log-' + level }, [
      el('span', { class: 'log-lvl', text: level.toUpperCase() }),
      el('span', { class: 'log-msg', text: msg })
    ]);
    cons.appendChild(line);
    while (cons.childNodes.length > LOG_MAX_LINES) cons.removeChild(cons.firstChild);
    var auto = $('opt-autoscroll');
    if (!auto || auto.checked) cons.scrollTop = cons.scrollHeight;
  }

  // Copie robuste : selectionne la zone puis tente execCommand('copy') (compatible
  // WebKit ancien / HTTP), le plus fiable sur la PS5. Renvoie true si la copie a eu lieu.
  function copyViaArea(area) {
    var ok = false;
    try {
      area.style.display = 'block';
      area.focus();
      area.select();
      try { area.setSelectionRange(0, (area.value || '').length); } catch (e) {}
      ok = !!(document.execCommand && document.execCommand('copy'));
    } catch (e) { ok = false; }
    return ok;
  }

  // Construit le journal complet en texte, l'affiche dans la zone et le copie.
  function copyLog() {
    var text = PSWKT.logger.toText();
    var area = $('log-copy-area');
    area.value = text;
    area.style.display = 'block';
    var n = PSWKT.logger.events.length;
    var base = 'Log: ' + n + ' lines, ' + text.length + ' bytes. ';
    // 1) voie la plus compatible (geste du clic) : execCommand sur la zone selectionnee.
    var copied = copyViaArea(area);
    if (copied) {
      $('log-copy-hint').textContent = base + 'Copied to clipboard.';
      return;
    }
    // 2) repli : API clipboard asynchrone (contexte securise uniquement).
    $('log-copy-hint').textContent = base + 'copying...';
    PSWKT.exporter.copyToClipboard(text).then(function (ok2) {
      $('log-copy-hint').textContent = base + (ok2 ? 'Copied to clipboard.' :
        'Select the text below and copy it (already highlighted).');
      if (!ok2) copyViaArea(area);
    });
  }

  function downloadLog() {
    var text = PSWKT.logger.toText();
    var name = PSWKT.exporter.filename('log.txt');
    var ok = PSWKT.exporter.downloadText(text, name, 'text/plain;charset=utf-8');
    var area = $('log-copy-area');
    area.value = text;
    area.style.display = 'block';
    $('log-copy-hint').textContent = ok ? ('Download started (' + name + ').') :
      'Download unavailable: select the area below to copy the log.';
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
    $('export-hint').textContent = 'Report ready (' + content.length + ' bytes). ' +
      'Select all the text below to copy it, or use the buttons.';
    // 2) tentative de telechargement
    var dl = PSWKT.exporter.downloadText(content, name, mime);
    // 3) copie : execCommand d'abord (compatible PS5), repli clipboard ensuite
    var copied = copyViaArea(area);
    var parts = [];
    if (dl) parts.push('download started (' + name + ')');
    if (copied) parts.push('copied to clipboard');
    if (parts.length) $('export-hint').textContent += '  [' + parts.join(' ; ') + ']';
    if (!copied) {
      PSWKT.exporter.copyToClipboard(content).then(function (ok2) {
        if (ok2) $('export-hint').textContent += '  [copied to clipboard]';
      });
    }
    PSWKT.logger.info('app', 'Export ' + kind + ' generated (' + content.length + ' bytes)');
  }

  // Enregistre un contenu sur le serveur local (dossier logs/), via POST.
  function saveToServer(content, format, name, hintEl) {
    hintEl.textContent = 'Saving to server...';
    try {
      var xhr = new XMLHttpRequest();
      var url = 'api/save-log.php?format=' + encodeURIComponent(format) + '&name=' + encodeURIComponent(name);
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          var path = '';
          try { path = JSON.parse(xhr.responseText).path; } catch (e) {}
          hintEl.textContent = 'Saved on server: ' + (path || 'logs/') + ' (' + content.length + ' bytes).';
          PSWKT.logger.info('app', 'Report saved on server: ' + path);
        } else {
          hintEl.textContent = 'Server save failed (status ' + xhr.status + '). Needs api/save-log.php on a PHP host with a writable logs/ folder.';
        }
      };
      xhr.onerror = function () {
        hintEl.textContent = 'Server endpoint unreachable. Needs api/save-log.php (PHP host). You can still export to JSON/TXT without any server.';
      };
      xhr.send(content);
    } catch (e) {
      hintEl.textContent = 'Save error: ' + e.message;
    }
  }

  function selectExportArea() {
    var area = $('export-area');
    area.style.display = 'block';
    area.focus();
    try { area.select(); } catch (e) {}
  }

  // --- Historique des sessions (persistance locale IndexedDB) ---
  function fmtWhen(iso) {
    try { var d = new Date(iso); return d.toLocaleString(); } catch (e) { return iso || '?'; }
  }
  function summaryChips(sm) {
    if (!sm || !sm.counts) return '';
    var c = sm.counts;
    return 'total ' + sm.total + ' \u00b7 passed ' + c.pass + ' \u00b7 failed ' + c.fail +
      ' \u00b7 errors ' + c.error + ' \u00b7 aborted ' + c.aborted + ' \u00b7 skipped ' + c.skip;
  }

  // Reconstruit un objet "report" exportable a partir d'une session stockee.
  function sessionToReport(session, records) {
    return {
      annotations: { count: 0, items: {} },
      meta: { tool: 'PSWKT', formatVersion: 1, generatedAt: session.startedAt, sessionId: session.id, mode: session.mode, href: null },
      environment: { userAgent: session.ua, platform: '', hardwareConcurrency: '', deviceMemoryGB: '', screen: { width: '', height: '', pixelRatio: '' } },
      playstation: { likelyPlaystation: false, hints: [] },
      features: {},
      run: { summary: session.summary || { total: records.length, counts: tallyRecords(records), totalDurationMs: 0, suiteAborted: session.status === 'interrupted' }, records: records },
      log: { durationMs: 0, globalErrors: [], events: [] }
    };
  }
  function tallyRecords(records) {
    var c = { pass: 0, fail: 0, skip: 0, error: 0, aborted: 0 };
    for (var i = 0; i < records.length; i++) { var s = records[i].status; if (c[s] === undefined) c[s] = 0; c[s]++; }
    return c;
  }

  function exportSession(session, kind) {
    PSWKT.store.getRecords(session.id).then(function (records) {
      var report = sessionToReport(session, records);
      var content = (kind === 'json') ? PSWKT.exporter.toJSON(report) : PSWKT.exporter.toDetailedText(report);
      var name = 'pswkt-session-' + session.id + '.' + (kind === 'json' ? 'json' : 'txt');
      var mime = (kind === 'json') ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
      var area = $('export-area'); area.value = content; area.style.display = 'block';
      var dl = PSWKT.exporter.downloadText(content, name, mime);
      $('history-hint').textContent = 'Session exported (' + content.length + ' bytes)' + (dl ? ' \u2014 download started (' + name + ')' : ' \u2014 select the Export area to copy') + '.';
      if (!dl) { try { area.focus(); area.select(); } catch (e) {} }
    });
  }

  function renderHistory() {
    if (!PSWKT.store || !$('history-list')) return;
    var kindEl = $('store-kind');
    if (kindEl) kindEl.textContent = '(storage: ' + PSWKT.store.kind + ')';
    PSWKT.store.listSessions().then(function (list) {
      var box = $('history-list'); clear(box);
      if (!list.length) { box.appendChild(el('p', { class: 'muted', text: 'No session recorded yet.' })); return; }
      for (var i = 0; i < list.length; i++) {
        (function (s) {
          var statusCls = s.status === 'done' ? 'pass' : (s.status === 'interrupted' || s.status === 'running' ? 'aborted' : 'neutral');
          var statusTxt = s.status === 'done' ? 'done' : (s.status === 'running' ? 'INTERRUPTED (crash?)' : (s.status === 'interrupted' ? 'interrupted' : s.status));
          var cb = el('input', { type: 'checkbox' }); cb.setAttribute('data-sid', s.id);
          cb.checked = !!state.compareSel[s.id];
          cb.onchange = function () { if (cb.checked) state.compareSel[s.id] = true; else delete state.compareSel[s.id]; };
          var head = el('div', { class: 'hist-head' }, [
            cb,
            el('span', { class: 'chip chip-' + statusCls, text: statusTxt }),
            el('span', { class: 'hist-label', text: (s.label || '(unnamed)') + '  \u00b7  ' + (s.mode || '') }),
            el('span', { class: 'hist-when muted', text: fmtWhen(s.startedAt) })
          ]);
          var sum = el('div', { class: 'hist-sum muted', text: summaryChips(s.summary) });
          var btns = el('div', { class: 'hist-btns' }, [
            mkMini('Export JSON', function () { exportSession(s, 'json'); }),
            mkMini('Export detailed TXT', function () { exportSession(s, 'text'); }),
            mkMini('Load into Results', function () { loadSessionIntoResults(s); }),
            mkMini('Delete', function () { if (confirmDel(s)) PSWKT.store.deleteSession(s.id).then(renderHistory); }, 'danger')
          ]);
          box.appendChild(el('div', { class: 'hist-row' }, [head, sum, btns]));
        })(list[i]);
      }
    });
  }
  function mkMini(label, fn, cls) {
    var b = el('button', { class: 'mini ' + (cls || 'ghost'), type: 'button', text: label });
    b.onclick = fn; return b;
  }
  function confirmDel(s) { return global.confirm ? global.confirm('Delete session "' + (s.label || s.id) + '"?') : true; }

  function loadSessionIntoResults(s) {
    PSWKT.store.getRecords(s.id).then(function (records) {
      if ($('results')) clear($('results'));
      for (var i = 0; i < records.length; i++) appendResultRow(records[i]);
      renderSummary(s.summary || { total: records.length, counts: tallyRecords(records), totalDurationMs: 0, suiteAborted: s.status !== 'done' });
      state.lastRun = { records: records, summary: s.summary || { total: records.length, counts: tallyRecords(records), totalDurationMs: 0, suiteAborted: false } };
      if ($('history-hint')) $('history-hint').textContent = 'Session "' + (s.label || s.id) + '" loaded into Results (' + records.length + ' tests).';
      switchTab('dashboard');
    });
  }

  // Comparaison de 2+ sessions selectionnees : tableau des compteurs cote a cote.
  function compareSessions() {
    var ids = []; for (var id in state.compareSel) if (state.compareSel.hasOwnProperty(id)) ids.push(id);
    var box = $('history-compare'); clear(box);
    if (ids.length < 2) { $('history-hint').textContent = 'Select at least 2 sessions to compare.'; return; }
    Promise.all(ids.map(function (id) { return PSWKT.store.getSession(id); })).then(function (sessions) {
      var keys = ['pass', 'fail', 'error', 'aborted', 'skip'];
      var labelsFr = { pass: 'passed', fail: 'failed', error: 'errors', aborted: 'aborted', skip: 'skipped' };
      var table = el('table', { class: 'cmp-table' });
      var thead = el('tr', {}, [el('th', { text: 'metric' })]);
      for (var i = 0; i < sessions.length; i++) thead.appendChild(el('th', { text: (sessions[i].label || sessions[i].id).slice(0, 18) + ' (' + fmtWhen(sessions[i].startedAt).slice(0, 16) + ')' }));
      table.appendChild(thead);
      table.appendChild(cmpRow('total', sessions, function (s) { return s.summary ? s.summary.total : '?'; }));
      for (var k = 0; k < keys.length; k++) {
        (function (key) {
          table.appendChild(cmpRow(labelsFr[key], sessions, function (s) { return s.summary && s.summary.counts ? s.summary.counts[key] : '?'; }));
        })(keys[k]);
      }
      table.appendChild(cmpRow('duration (ms)', sessions, function (s) { return s.summary ? s.summary.totalDurationMs : '?'; }));
      table.appendChild(cmpRow('state', sessions, function (s) { return s.status; }));
      box.appendChild(el('h4', { text: 'Comparison of ' + sessions.length + ' sessions' }));
      box.appendChild(table);
      $('history-hint').textContent = '';
    });
  }
  function cmpRow(label, sessions, getter) {
    var tr = el('tr', {}, [el('td', { text: label })]);
    for (var i = 0; i < sessions.length; i++) tr.appendChild(el('td', { text: String(getter(sessions[i])) }));
    return tr;
  }

  // Au chargement : detecte une session restee "running" (crash probable au run precedent).
  function checkInterrupted() {
    if (!PSWKT.store) return;
    PSWKT.store.findInterrupted().then(function (list) {
      if (!list.length) return;
      var s = list[0];
      PSWKT.store.getRunning(s.id).then(function (run) {
        var banner = $('crash-banner');
        if (!banner) return;
        var who = run && run.test ? (run.test.name + ' (' + run.test.id + ')') : 'an unknown test';
        banner.style.display = 'block';
        clear(banner);
        banner.appendChild(el('strong', { text: '⚠ Previous session interrupted. ' }));
        banner.appendChild(document.createTextNode('The last test launched was: ' + who + '. '));
        banner.appendChild(document.createTextNode('It most likely froze or crashed the browser (this may simply be the browser hitting a normal resource limit). '));
        var view = mkMini('View this session', function () { loadSessionIntoResults(s); });
        var ok = mkMini('OK, mark as seen', function () {
          PSWKT.store.finishSession(s.id, s.summary, true).then(function () { banner.style.display = 'none'; renderHistory(); });
        }, 'danger');
        banner.appendChild(view); banner.appendChild(ok);
      });
    });
  }

  // --- Init ---
  function init() {
    PSWKT.annotations = PSWKT.annotations || {};
    // Each wiring step is isolated so a single failure never kills the whole UI.
    function safe(label, fn) { try { fn(); } catch (e) { try { PSWKT.logger.warn('app', 'init step failed: ' + label, { message: e && e.message }); } catch (x) {} } }

    safe('environment', renderEnvironment);
    safe('catalog', renderCatalog);
    safe('logger', wireLogger);

    function on(id, fn) { var e = $(id); if (e) e.onclick = fn; }

    // Tab navigation
    var tabs = document.querySelectorAll('.tab');
    for (var ti = 0; ti < tabs.length; ti++) {
      (function (t) { t.onclick = function () { switchTab(t.getAttribute('data-tab')); }; })(tabs[ti]);
    }
    // Deep link: index.html#categories
    try { var h = (global.location && global.location.hash || '').replace('#', ''); if (/^(dashboard|categories|history|about)$/.test(h)) switchTab(h); } catch (e) {}

    on('btn-run-all', function () {
      // Non-destructive tests + individually checked aggressive ones (if aggressive mode is on).
      var tests = $('aggressive-list') ? collectHomeRunTests() : R.listTests();
      runTests(tests, 'all tests');
    });
    on('btn-run-selected', function () { runTests(getSelectedTests(), 'selection'); });

    // Aggressive mode: reveal/hide the aggressive test list.
    if ($('opt-aggressive')) $('opt-aggressive').onchange = updateAggressiveListVisibility;
    updateAggressiveListVisibility();
    on('btn-check-all', function () { setAllChecks(true); });
    on('btn-uncheck-all', function () { setAllChecks(false); });
    on('btn-expand-all', function () { setAllCategoriesOpen(true); });
    on('btn-collapse-all', function () { setAllCategoriesOpen(false); });
    on('btn-stop', stopRun);
    on('btn-stop-2', stopRun);
    on('btn-options-toggle', function () {
      var p = $('options-panel'); if (p) p.style.display = (p.style.display === 'none' ? '' : 'none');
    });
    on('btn-export-json', function () { doExport('json'); });
    on('btn-export-text', function () { doExport('text'); });
    on('btn-select-export', selectExportArea);
    on('btn-clear-log', function () { clear($('log-console')); });
    on('btn-copy-log', copyLog);
    on('btn-download-log', downloadLog);
    on('btn-save-log-server', function () { saveToServer(PSWKT.logger.toText(), 'txt', 'journal', $('log-copy-hint')); });
    on('btn-save-detailed-server', function () {
      var report = PSWKT.exporter.buildReport(state.lastRun);
      saveToServer(PSWKT.exporter.toDetailedText(report), 'txt', 'detaille', $('log-copy-hint'));
    });
    on('btn-save-server', function () {
      var report = PSWKT.exporter.buildReport(state.lastRun);
      saveToServer(PSWKT.exporter.toJSON(report), 'json', 'rapport', $('export-hint'));
    });

    // Recherche / filtre des resultats
    if ($('result-search')) $('result-search').oninput = applyResultFilter;
    var fids = ['filter-pass', 'filter-fail', 'filter-error', 'filter-aborted', 'filter-skip'];
    for (var fi = 0; fi < fids.length; fi++) { if ($(fids[fi])) $(fids[fi]).onchange = applyResultFilter; }

    // Historique des sessions (IndexedDB)
    if ($('btn-history-refresh')) $('btn-history-refresh').onclick = renderHistory;
    if ($('btn-history-compare')) $('btn-history-compare').onclick = compareSessions;
    if ($('btn-history-clear')) $('btn-history-clear').onclick = function () {
      if (!global.confirm || global.confirm('Delete ALL locally stored sessions?')) {
        PSWKT.store.listSessions().then(function (list) {
          var ps = list.map(function (s) { return PSWKT.store.deleteSession(s.id); });
          Promise.all(ps).then(function () { state.compareSel = {}; if ($('history-compare')) clear($('history-compare')); renderHistory(); });
        });
      }
    };
    if (PSWKT.store) { safe('history', renderHistory); safe('crash-check', checkInterrupted); }

    setRunningUI(false);
    PSWKT.logger.info('app', 'UI ready. ' + R.listTests().length + ' tests in ' +
      R.listCategories().length + ' categories.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
