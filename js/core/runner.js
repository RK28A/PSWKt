/*
 * PSWKT - Harnais d'execution des tests
 * - Enregistrement des tests par categorie
 * - Verification prealable des fonctionnalites requises (sinon : skip)
 * - Execution sequentielle non bloquante (rend la main entre chaque test)
 * - Mesure de duree, capture des erreurs par test, respect des garde-fous
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  var registry = [];       // tous les tests
  var categories = {};     // id -> { id, label, description }

  function defineCategory(id, label, description) {
    categories[id] = { id: id, label: label, description: description || '' };
  }

  /*
   * Un test :
   * {
   *   id: string unique,
   *   name: string lisible,
   *   category: id de categorie,
   *   description: string,
   *   requires: [chemins de features, ex 'typedArrays.Float64Array'] (optionnel),
   *   destructive: false (par defaut ; le harnais refuse d'executer si true sans override),
   *   run: function(ctx) -> renvoie un objet resultat (ou via Promise)
   * }
   * ctx fournit : { budget, log(level,msg,data), tick(), yield(), features }
   */
  function register(test) {
    if (!test || !test.id) throw new Error('test invalide : id manquant');
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === test.id) throw new Error('id de test duplique : ' + test.id);
    }
    if (typeof test.run !== 'function') throw new Error('test ' + test.id + ' : run() manquant');
    if (test.destructive === undefined) test.destructive = false;
    if (test.requires === undefined) test.requires = [];
    registry.push(test);
    return test;
  }

  // Classification lisible d'un resultat : distingue vraiment les cas.
  function classify(status, detail) {
    detail = detail || '';
    if (status === 'pass') return { code: 'conforme', label: 'Conforme' };
    if (status === 'fail') return { code: 'incorrect', label: 'Comportement incorrect (invariant viole)' };
    if (status === 'error') return { code: 'exception', label: 'Exception JavaScript non prevue' };
    if (status === 'aborted') return /echeance|delai/i.test(detail) ? { code: 'timeout', label: 'Delai depasse' } : { code: 'interrompu', label: 'Interrompu (Stop / arret)' };
    if (status === 'skip') return /destructif/i.test(detail) ? { code: 'non_execute', label: 'Non execute (mode agressif desactive)' } : { code: 'incompatible', label: 'Fonctionnalite indisponible' };
    return { code: status, label: status };
  }

  function listCategories() {
    var out = [];
    for (var key in categories) {
      if (categories.hasOwnProperty(key)) {
        var count = 0;
        for (var i = 0; i < registry.length; i++) {
          if (registry[i].category === key) count++;
        }
        out.push({ id: categories[key].id, label: categories[key].label, description: categories[key].description, count: count });
      }
    }
    return out;
  }

  function listTests(categoryId) {
    var out = [];
    for (var i = 0; i < registry.length; i++) {
      if (!categoryId || registry[i].category === categoryId) out.push(registry[i]);
    }
    return out;
  }

  // Resout un chemin 'typedArrays.Float64Array' dans le rapport de features.
  function featureAvailable(featuresReport, path) {
    try {
      var parts = path.split('.');
      var cur = featuresReport.features;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return false;
        cur = cur[parts[i]];
      }
      return cur === true;
    } catch (e) { return false; }
  }

  function missingRequirements(test, featuresReport) {
    var missing = [];
    for (var i = 0; i < test.requires.length; i++) {
      if (!featureAvailable(featuresReport, test.requires[i])) missing.push(test.requires[i]);
    }
    return missing;
  }

  // Construit le contexte passe a un test.
  function makeContext(test, budget, featuresReport, options) {
    var logger = PSWKT.logger;
    return {
      budget: budget,
      features: featuresReport,
      tick: function (step) { return budget.tick(step); },
      yield: function () { return PSWKT.guard.yieldToEventLoop(); },
      charge: function (bytes) { return budget.charge(bytes); },
      log: function (level, msg, data) { return logger.log(level, test.id, msg, data); },
      info: function (msg, data) { return logger.log('info', test.id, msg, data); },
      metric: function (msg, data) { return logger.log('metric', test.id, msg, data); },
      // flush() : force l'ecriture sur le serveur des logs accumules (enregistrement
      // continu). A appeler par les tests agressifs AVANT une etape qui peut tout
      // figer, pour que le jalon soit persiste sur disque meme en cas de crash.
      flush: function () {
        if (options && typeof options.onFlush === 'function') {
          try { return options.onFlush(); } catch (e) { /* le flush ne doit jamais casser un test */ }
        }
        return false;
      }
    };
  }

  /*
   * Execute un seul test. Renvoie une Promise resolue avec un objet resultat :
   * { id, name, category, status, durationMs, detail, measurements, budget, error }
   * status : pass | fail | skip | error | aborted
   */
  function runOne(test, options, featuresReport) {
    options = options || {};
    var logger = PSWKT.logger;

    // Garde-fou : refuse les tests destructifs sauf autorisation explicite.
    if (test.destructive && !options.allowDestructive) {
      logger.warn(test.id, 'Test destructif ignore (autorisation requise)');
      return Promise.resolve({
        id: test.id, name: test.name, category: test.category,
        description: test.description || '', destructive: true,
        status: 'skip', classification: classify('skip', 'test destructif non autorise'),
        durationMs: 0, detail: 'test destructif non autorise (Mode agressif desactive)',
        measurements: null, error: null
      });
    }

    // Verifie les fonctionnalites requises.
    var missing = missingRequirements(test, featuresReport);
    if (missing.length) {
      logger.log('skip', test.id, 'Ignore : fonctionnalites absentes', { missing: missing });
      return Promise.resolve({
        id: test.id, name: test.name, category: test.category,
        description: test.description || '', destructive: !!test.destructive,
        status: 'skip', classification: classify('skip', 'fonctionnalites absentes'),
        durationMs: 0, detail: 'fonctionnalites absentes : ' + missing.join(', '),
        measurements: null, error: null
      });
    }

    // Les tests destructifs (mode agressif) ignorent volontairement les garde-fous
    // ordinaires : ils doivent pouvoir pousser les API jusqu'a la rupture (figer /
    // planter le navigateur). Le bouton Stop reste operant via budget.requestAbort,
    // tant que le test appelle ctx.tick() (impossible pour une operation synchrone
    // unique comme un backtracking regex). Une echeance large sert de filet si le
    // test est seulement lent plutot que fatal.
    var destructive = !!test.destructive;
    var budget = new PSWKT.guard.Budget({
      timeoutMs: destructive ? Math.max(options.timeoutMs || 0, 30000) : options.timeoutMs,
      memoryBudgetBytes: destructive ? Number.MAX_SAFE_INTEGER : options.memoryBudgetBytes,
      maxIterations: destructive ? Number.MAX_SAFE_INTEGER : options.maxIterations
    });
    if (options.registerBudget) options.registerBudget(budget);

    var ctx = makeContext(test, budget, featuresReport, options);
    var heapBefore = PSWKT.guard.readHeap();
    var started = PSWKT.now();

    if (!test.quiet) logger.info(test.id, 'Debut : ' + test.name);

    // Microtache (pas de macrotache forcee) : la suite gere la reddition periodique.
    return Promise.resolve()
      .then(function () {
        return test.run(ctx); // peut etre sync ou retourner une Promise
      })
      .then(function (result) {
        var durationMs = Math.round((PSWKT.now() - started) * 1000) / 1000;
        var heapAfter = PSWKT.guard.readHeap();
        result = result || {};
        var status = result.status || 'pass';
        var record = {
          id: test.id, name: test.name, category: test.category,
          description: test.description || '', destructive: !!test.destructive,
          status: status,
          classification: classify(status, result.detail || ''),
          durationMs: durationMs,
          detail: result.detail || '',
          measurements: result.measurements || null,
          budget: budget.summary(),
          heap: { before: heapBefore, after: heapAfter },
          error: null
        };
        if (!test.quiet && record.measurements) {
          logger.log('metric', test.id, 'mesures', record.measurements);
        }
        if (!test.quiet && record.heap && record.heap.before && record.heap.after) {
          logger.log('metric', test.id, 'tas JS (Mo)', {
            avant: Math.round(record.heap.before.usedJSHeapSize / 1048576 * 100) / 100,
            apres: Math.round(record.heap.after.usedJSHeapSize / 1048576 * 100) / 100
          });
        }
        logger.log(status === 'pass' ? 'pass' : (status === 'fail' ? 'fail' : 'info'),
          test.id, 'Fin : ' + status + ' (' + durationMs + ' ms)', { detail: record.detail });
        return record;
      })
      .catch(function (err) {
        var durationMs = Math.round((PSWKT.now() - started) * 1000) / 1000;
        var heapAfter = PSWKT.guard.readHeap();
        var aborted = PSWKT.guard.isAbort(err);
        var abDetail = aborted ? ('arrete : ' + err.message) : 'exception non geree pendant le test';
        var record = {
          id: test.id, name: test.name, category: test.category,
          description: test.description || '', destructive: !!test.destructive,
          status: aborted ? 'aborted' : 'error',
          classification: classify(aborted ? 'aborted' : 'error', abDetail),
          durationMs: durationMs,
          detail: abDetail,
          measurements: null,
          budget: budget.summary(),
          heap: { before: heapBefore, after: heapAfter },
          error: {
            name: (err && err.name) || 'Error',
            message: (err && err.message) || String(err),
            stack: (err && err.stack) ? String(err.stack) : null
          }
        };
        logger.log(aborted ? 'warn' : 'error', test.id,
          (aborted ? 'Arrete : ' : 'Erreur : ') + record.error.message,
          { stack: record.error.stack });
        // Rappel important : une erreur JS ici est un fait a documenter, PAS une vulnerabilite.
        return record;
      });
  }

  /*
   * Execute une liste de tests sequentiellement.
   * options.onProgress(done, total, lastRecord) est appele apres chaque test.
   * Renvoie une Promise resolue avec { records: [...], summary: {...} }.
   * Un controleur d'arret partage permet d'interrompre entre deux tests et,
   * en cooperation, pendant un test (via budget.requestAbort).
   */
  function runSuite(tests, options) {
    options = options || {};
    var featuresReport = PSWKT.features.report();
    var records = [];
    var i = 0;
    var control = options.control || { aborted: false, currentBudget: null };

    options.registerBudget = function (b) { control.currentBudget = b; };

    var lastYield = PSWKT.now();
    function step() {
      if (i >= tests.length || control.aborted) {
        return Promise.resolve();
      }
      var test = tests[i];
      // Hook pre-test : ecrit un marqueur "test en cours" AVANT d'executer le test
      // (identification du test fautif en cas de crash). On ATTEND ce que le hook
      // renvoie : pour un test destructif, l'app renvoie la Promise d'ecriture
      // IndexedDB, donc la trace est persistee avant de lancer le test risque.
      var startP = null;
      if (typeof options.onTestStart === 'function') {
        try { startP = options.onTestStart(test, i, tests.length); } catch (e) { startP = null; }
      }
      return Promise.resolve(startP).then(function () {
        return runOne(test, options, featuresReport);
      }).then(function (record) {
        records.push(record);
        i++;
        if (typeof options.onProgress === 'function') {
          try { options.onProgress(i, tests.length, record); } catch (e) { /* UI ne doit pas casser la suite */ }
        }
        // Reddition de main a l'event loop seulement toutes les ~30 ms : l'UI se met
        // a jour et Stop peut agir, sans payer une macrotache par test (centaines de tests).
        var nowT = PSWKT.now();
        if (nowT - lastYield > 30) {
          lastYield = nowT;
          return PSWKT.guard.yieldToEventLoop().then(step);
        }
        return Promise.resolve().then(step);
      });
    }

    var startedAll = PSWKT.now();
    return step().then(function () {
      var summary = summarize(records, Math.round((PSWKT.now() - startedAll) * 1000) / 1000, control.aborted);
      return { records: records, summary: summary };
    });
  }

  function summarize(records, totalMs, aborted) {
    var counts = { pass: 0, fail: 0, skip: 0, error: 0, aborted: 0 };
    for (var i = 0; i < records.length; i++) {
      var s = records[i].status;
      if (counts[s] === undefined) counts[s] = 0;
      counts[s]++;
    }
    return {
      total: records.length,
      counts: counts,
      totalDurationMs: totalMs,
      suiteAborted: !!aborted
    };
  }

  PSWKT.runner = {
    defineCategory: defineCategory,
    register: register,
    listCategories: listCategories,
    listTests: listTests,
    runOne: runOne,
    runSuite: runSuite,
    classify: classify,
    _registry: registry
  };

})(typeof window !== 'undefined' ? window : this);
