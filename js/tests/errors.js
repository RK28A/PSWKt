/*
 * PSWKT - Tests : gestion des erreurs et exceptions
 * Toutes les erreurs ici sont INTENTIONNELLES et CAPTUREES : elles documentent
 * le comportement du moteur, ce ne sont pas des plantages ni des vulnerabilites.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('errors', 'Errors & exceptions', 'try/catch/finally, error types, call stack, promise rejections (caught).');

  // 1) try / catch / finally : ordre d'execution.
  R.register({
    id: 'err.trycatchfinally',
    name: 'try / catch / finally',
    category: 'errors',
    description: 'Verifie que finally s execute meme en cas d exception.',
    requires: [],
    run: function (ctx) {
      var order = [];
      try {
        order.push('try');
        throw new Error('intentionnelle');
      } catch (e) {
        order.push('catch:' + e.message);
      } finally {
        order.push('finally');
      }
      ctx.info('ordre = ' + order.join(' -> '));
      var ok = (order.join(',') === 'try,catch:intentionnelle,finally');
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'ordre : ' + order.join(' -> '),
        measurements: { order: order }
      };
    }
  });

  // 2) Types d'erreurs natifs : TypeError, RangeError, ReferenceError, SyntaxError.
  R.register({
    id: 'err.types',
    name: 'Native error types',
    category: 'errors',
    description: 'Declenche et capture chaque type d erreur standard.',
    requires: [],
    run: function (ctx) {
      var results = {};
      // TypeError : appeler un non-fonction
      try { var x = null; x(); } catch (e) { results.TypeError = e.name; ctx.info('TypeError capture : ' + e.message); }
      // RangeError : tableau de longueur invalide
      try { new Array(-1); } catch (e) { results.RangeError = e.name; ctx.info('RangeError capture : ' + e.message); }
      // ReferenceError : variable non definie
      try { /* eslint-disable no-undef */ void variableInexistante; } catch (e) { results.ReferenceError = e.name; ctx.info('ReferenceError capture : ' + e.message); }
      // SyntaxError : via eval d'un code invalide
      try { eval('function('); } catch (e) { results.SyntaxError = e.name; ctx.info('SyntaxError capture : ' + e.message); }
      // URIError : decodeURIComponent invalide
      try { decodeURIComponent('%'); } catch (e) { results.URIError = e.name; ctx.info('URIError capture : ' + e.message); }
      var ok = (results.TypeError === 'TypeError' && results.RangeError === 'RangeError' &&
        results.ReferenceError === 'ReferenceError' && results.SyntaxError === 'SyntaxError' &&
        results.URIError === 'URIError');
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'captures : ' + Object.keys(results).join(', '),
        measurements: results
      };
    }
  });

  // 3) Pile d'appels : presence et profondeur de error.stack.
  R.register({
    id: 'err.stack',
    name: 'Call stack (error.stack)',
    category: 'errors',
    description: 'Verifie la presence de la pile et compte ses niveaux.',
    requires: [],
    run: function (ctx) {
      function deep3() { throw new Error('depuis deep3'); }
      function deep2() { deep3(); }
      function deep1() { deep2(); }
      var stack = null, lines = 0;
      try { deep1(); } catch (e) { stack = e.stack || null; }
      if (stack) {
        lines = String(stack).split('\n').length;
        ctx.info('pile presente, ' + lines + ' lignes');
        ctx.metric('extrait pile', String(stack).split('\n').slice(0, 4));
      } else {
        ctx.info('error.stack absent sur ce moteur');
      }
      return {
        status: 'pass',
        detail: stack ? ('pile presente (' + lines + ' lignes)') : 'error.stack non fourni par le moteur',
        measurements: { hasStack: !!stack, lines: lines }
      };
    }
  });

  // 4) Sous-classe d'erreur personnalisee et instanceof.
  R.register({
    id: 'err.custom',
    name: 'Custom error (subclass)',
    category: 'errors',
    description: 'Cree une sous-classe d Error et verifie la chaine instanceof.',
    requires: [],
    run: function (ctx) {
      function AppError(msg, code) {
        var e = Error.call(this, msg);
        this.name = 'AppError';
        this.message = msg;
        this.code = code;
        if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
        else this.stack = e.stack;
      }
      AppError.prototype = Object.create(Error.prototype);
      AppError.prototype.constructor = AppError;

      var caught = null;
      try { throw new AppError('echec metier', 42); } catch (e) { caught = e; }
      ctx.info('instanceof AppError : ' + (caught instanceof AppError));
      ctx.info('instanceof Error : ' + (caught instanceof Error));
      var ok = (caught instanceof AppError && caught instanceof Error && caught.code === 42);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'AppError=' + (caught instanceof AppError) + ', Error=' + (caught instanceof Error) + ', code=' + caught.code,
        measurements: { isAppError: caught instanceof AppError, isError: caught instanceof Error, code: caught.code }
      };
    }
  });

  // 5) Rejet de promesse capture (asynchrone, ne remonte pas en erreur globale).
  R.register({
    id: 'err.promise.reject',
    name: 'Caught promise rejection',
    category: 'errors',
    description: 'Rejette une promesse et la rattrape proprement (test asynchrone).',
    requires: ['timing.Promise'],
    run: function (ctx) {
      ctx.info('creation d une promesse rejetee...');
      return Promise.reject(new Error('rejet volontaire'))
        .then(function () {
          return { status: 'fail', detail: 'la promesse aurait du etre rejetee', measurements: null };
        }, function (err) {
          ctx.info('rejet rattrape : ' + err.message);
          return {
            status: 'pass',
            detail: 'rejet rattrape proprement : ' + err.message,
            measurements: { caught: true, message: err.message }
          };
        });
    }
  });

})(typeof window !== 'undefined' ? window : this);
