/*
 * PSWKT - Resource guards
 * Gives tests: a deadline, an allocation memory budget,
 * an iteration cap and a cooperative abort signal.
 *
 * Important: JavaScript is single-threaded. An infinite synchronous loop CANNOT
 * be interrupted from the outside. Tests must therefore call ctx.tick()
 * regularly to honour the deadline and the abort signal.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT = global.PSWKT || {};

  var DEFAULTS = {
    timeoutMs: 4000,          // per-test deadline
    memoryBudgetBytes: 64 * 1024 * 1024, // max 64 MB cumulative allocations per test
    maxIterations: 5000000,   // hard iteration cap
    tickEveryMs: 50           // frequence de reddition de main a l'event loop (si chunke)
  };

  // Typed error to tell a deliberate abort apart from a real JS error.
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

  // External abort request (Stop button).
  Budget.prototype.requestAbort = function (reason) {
    this._aborted = true;
    this._abortReason = reason || 'user request';
  };

  Budget.prototype.isExpired = function () {
    return PSWKT.now() >= this.deadline;
  };

  Budget.prototype.timeLeftMs = function () {
    return Math.max(0, this.deadline - PSWKT.now());
  };

  // Records an allocation intent; returns false if the budget is exceeded.
  Budget.prototype.charge = function (bytes) {
    this.allocatedBytes += bytes;
    return this.allocatedBytes <= this.memoryBudgetBytes;
  };

  Budget.prototype.remainingBytes = function () {
    return Math.max(0, this.memoryBudgetBytes - this.allocatedBytes);
  };

  /*
   * tick(): call inside loops. Counts an iteration and checks
   * the abort, the deadline and the iteration cap. Throws AbortError if needed.
   * Returns the current iteration count.
   */
  Budget.prototype.tick = function (step) {
    this.iterations += (step || 1);
    if (this._aborted) {
      throw new AbortError('abort: ' + (this._abortReason || 'unknown'));
    }
    if (this.iterations > this.maxIterations) {
      throw new AbortError('iteration cap reached (' + this.maxIterations + ')');
    }
    if (this.isExpired()) {
      throw new AbortError('deadline exceeded (' + this.timeoutMs + ' ms)');
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

  // Wraps a Promise with a maximum delay (for asynchronous tests:
  // workers, crypto, timers...). Rejette avec AbortError si le delai expire.
  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new AbortError('async deadline exceeded' + (label ? ' (' + label + ')' : '') + ' after ' + ms + ' ms'));
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

  // Waits ms milliseconds (to measure timer drift).
  function delay(ms) {
    return new Promise(function (resolve) { global.setTimeout(resolve, ms); });
  }

  // Yields to the event loop (lets the UI breathe and the Stop button act).
  function yieldToEventLoop() {
    return new Promise(function (resolve) {
      if (typeof global.setTimeout === 'function') {
        global.setTimeout(resolve, 0);
      } else {
        resolve();
      }
    });
  }

  // Reads JS memory if the non-standard API is available (Chrome/old WebKit).
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
