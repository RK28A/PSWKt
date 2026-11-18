/*
 * PSWKT - Garde-fous de ressources
 * Fournit aux tests : une echeance (deadline), un budget memoire d'allocation,
 * un plafond d'iterations et un signal d'arret cooperatif.
 *
 * Important : JavaScript est mono-thread. Une boucle synchrone infinie ne peut PAS
 * etre interrompue de l'exterieur. Les tests doivent donc appeler ctx.tick()
 * regulierement pour respecter l'echeance et le signal d'arret.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  var DEFAULTS = {
    timeoutMs: 4000,          // echeance par test
    memoryBudgetBytes: 64 * 1024 * 1024, // 64 Mo d'allocations cumulees max par test
    maxIterations: 5000000,   // plafond dur d'iterations
    tickEveryMs: 50           // frequence de reddition de main a l'event loop (si chunke)
  };

  // Erreur typee pour distinguer un arret volontaire d'une vraie erreur JS.
  function AbortError(reason) {
    this.name = 'PSWKTAbort';
    this.message = reason || 'arret';
    this.aborted = true;
  }
  AbortError.prototype = Object.create(Error.prototype);

  function Budget(opts) {
    opts = opts || {};
    this.timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : DEFAULTS.timeoutMs;
    this.memoryBudgetBytes = typeof opts.memoryBudgetBytes === 'number' ? opts.memoryBudgetBytes : DEFAULTS.memoryBudgetBytes;
    this.maxIterations = typeof opts.maxIterations === 'number' ? opts.maxIterations : DEFAULTS.maxIterations;

    this.deadline = PSWKT.now() + this.timeoutMs;
    this.iterations = 0;
    this.allocatedBytes = 0;
    this._aborted = false;
    this._abortReason = null;
  }

  // Demande d'arret externe (bouton Stop).
  Budget.prototype.requestAbort = function (reason) {
    this._aborted = true;
    this._abortReason = reason || 'demande utilisateur';
  };

  Budget.prototype.isExpired = function () {
    return PSWKT.now() >= this.deadline;
  };

  Budget.prototype.timeLeftMs = function () {
    return Math.max(0, this.deadline - PSWKT.now());
  };

  // Enregistre une intention d'allocation ; renvoie false si le budget est depasse.
  Budget.prototype.charge = function (bytes) {
    this.allocatedBytes += bytes;
    return this.allocatedBytes <= this.memoryBudgetBytes;
  };

  Budget.prototype.remainingBytes = function () {
    return Math.max(0, this.memoryBudgetBytes - this.allocatedBytes);
  };

  /*
   * tick() : a appeler dans les boucles. Compte une iteration et verifie
   * l'arret, l'echeance et le plafond d'iterations. Leve AbortError le cas echeant.
   * Renvoie le nombre d'iterations courant.
   */
  Budget.prototype.tick = function (step) {
    this.iterations += (step || 1);
    if (this._aborted) {
      throw new AbortError('arret : ' + (this._abortReason || 'inconnu'));
    }
    if (this.iterations > this.maxIterations) {
      throw new AbortError('plafond d iterations atteint (' + this.maxIterations + ')');
    }
    if (this.isExpired()) {
      throw new AbortError('echeance depassee (' + this.timeoutMs + ' ms)');
    }
    return this.iterations;
  };

  Budget.prototype.summary = function () {
    return {
      timeoutMs: this.timeoutMs,
      iterations: this.iterations,
      allocatedBytes: this.allocatedBytes,
      memoryBudgetBytes: this.memoryBudgetBytes,
      aborted: this._aborted,
      abortReason: this._abortReason
    };
  };

  // Enveloppe une Promise avec un delai maximal (pour les tests asynchrones :
  // workers, crypto, timers...). Rejette avec AbortError si le delai expire.
  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new AbortError('delai asynchrone depasse' + (label ? ' (' + label + ')' : '') + ' apres ' + ms + ' ms'));
      }, ms);
      Promise.resolve(promise).then(function (v) {
        if (settled) return;
        settled = true;
        try { global.clearTimeout(timer); } catch (e) {}
        resolve(v);
      }, function (e) {
        if (settled) return;
        settled = true;
        try { global.clearTimeout(timer); } catch (e2) {}
        reject(e);
      });
    });
  }

  // Attend ms millisecondes (pour mesurer la derive des timers).
  function delay(ms) {
    return new Promise(function (resolve) { global.setTimeout(resolve, ms); });
  }

  // Rend la main a l'event loop (laisse l'UI respirer et le bouton Stop agir).
  function yieldToEventLoop() {
    return new Promise(function (resolve) {
      if (typeof global.setTimeout === 'function') {
        global.setTimeout(resolve, 0);
      } else {
        resolve();
      }
    });
  }

  // Lit la memoire JS si l'API non standard est disponible (Chrome/anciens WebKit).
  function readHeap() {
    try {
      if (global.performance && global.performance.memory) {
        var m = global.performance.memory;
        return {
          usedJSHeapSize: m.usedJSHeapSize,
          totalJSHeapSize: m.totalJSHeapSize,
          jsHeapSizeLimit: m.jsHeapSizeLimit
        };
      }
    } catch (e) { /* non disponible */ }
    return null;
  }

  PSWKT.guard = {
    DEFAULTS: DEFAULTS,
    AbortError: AbortError,
    Budget: Budget,
    yieldToEventLoop: yieldToEventLoop,
    withTimeout: withTimeout,
    delay: delay,
    readHeap: readHeap,
    isAbort: function (e) { return !!(e && e.aborted); }
  };

})(typeof window !== 'undefined' ? window : this);
