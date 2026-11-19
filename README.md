# PSWKT — WebKit Test Lab

A browser-only **JavaScript / WebKit diagnostic, mapping and robustness lab**, designed to run
in a WebKit browser — in particular the PlayStation 5 browser — as well as any modern browser.
No dependencies, no build step: static HTML / CSS / JS files. From **gentle, reproducible probing**
(what is really available, how the APIs behave) up to an **aggressive stress mode** that pushes
the engine toward its limits.

A JavaScript error observed here is a **behaviour to document**, not a security finding.

## What it does

- **Environment & feature detection.** Checks what is *actually* available (typed arrays,
  Canvas/WebGL, Proxy/Map/Set, WeakRef, `performance.memory`, WebAssembly…). Tests whose
  prerequisites are missing are automatically **skipped**.
- **~1800 independent tests** across **27 categories**, using varied techniques: synchronous,
  asynchronous/Promise, Web Worker, microtasks, `requestAnimationFrame`, `try/catch` probing,
  high-resolution timing, data-driven generation, **malformed-input fuzzing** and
  **aggressive stress testing**.
- **Result classification.** Each result is classified as *Conformant*, *Incorrect behaviour*,
  *Unexpected JavaScript exception*, *Deadline exceeded*, *Interrupted*, *Feature unavailable* or
  *Not run*. An expected, caught exception is **not** reported as a problem.
- **Annotations.** A quick tag (OK / Slow / Froze / Reloaded / Other) and a free note per result,
  carried into the exported report.
- **Ultra-detailed logging.** For each test: the action, the step-by-step run (action → engine
  reaction), the verdict in plain words, full measurements, stack, heap before/after, budget.
- **Local session history, no server (IndexedDB).** Every run creates a new session stored
  locally in the browser (with a memory/localStorage fallback). Sessions can be viewed, exported
  (JSON / detailed TXT), compared and deleted. This works on static hosting with no server.
- **Crash-survivor marker.** Before each test, a “test running” marker is written to IndexedDB;
  on reload after a crash, a banner names the last test that was launched.
- **Search & filters** on the results, and **two modes**: *diagnostic* (default) and *stress*.
- **Optional server-side log saving** via small **PHP** scripts (`api/save-log.php`,
  `api/log-stream.php`) when hosted on a PHP host such as InfinityFree. Entirely optional.

## Interface — a single page with real tabs

- **Dashboard** — a big **Run all tests** button, progress, results and the console.
- **Categories** — the full catalogue; categories are **collapsible and collapsed by default**,
  with per-test and per-category run buttons, and a custom **Run selection**.
- **History** — local sessions: view, export, compare, delete.
- **About** — environment, feature grid, and the notes below.

The UI is built to be **navigable with a game-pad / D-pad on the PS5 browser**: every control is a
native focusable element with a strong, highly visible focus ring, so spatial navigation is easy
to follow on a TV.

## Hosting — 100% static

**No server is required.** The app is entirely client-side; results persist in **IndexedDB**
(with a memory/localStorage fallback) and export to JSON and TXT. It therefore runs as-is on free
static hosting.

Upload `index.html`, `css/`, `js/` and `api/` to your web root, open the URL — that is all (no
database, no server process, no cron). `tests.html` simply redirects to `index.html#categories`.

**Optional server-side saving:** if your host runs PHP (InfinityFree does), the two scripts in
`api/` let the "save to server" buttons write reports/logs into a `logs/` folder. The app is fully
usable without them (IndexedDB + JSON/TXT export) — no database and no server needed.

## Running locally

Serve the folder with any static web server and open it in a browser, for example:

```
# VS Code: "Live Server" extension, or any static file server you like
# then open http://localhost:<port>/
```

From the PS5, open your static-hosting URL (or your PC's local server address).

## Hunting crashes on the PS5

1. Open the **Dashboard**, tick **Aggressive mode** → the list of destructive tests appears, all
   **unchecked**. Tick only the one(s) you want.
2. Run them **one at a time** rather than all at once, to isolate which one fails.
3. If the browser freezes/crashes, **reload the page**: a banner names the last test launched (the
   likely culprit), and the session is in **History** (exportable to JSON/TXT).

## Scope, honesty and limits

- **Aggressive tests can freeze or crash the browser tab.** Many of these crashes are simply the
  browser **hitting its normal resource limits** (memory, stack depth, allocation caps) — they are
  not necessarily defects, and they are not security findings.
- **No absolute safety guarantee.** A sandboxed browser **strongly limits** risk — browser
  JavaScript does not have access to the console’s hardware or firmware — but no guarantee of
  “no possible consequence whatsoever” can be made. In practice the realistic worst case is the
  **tab dying and the console restarting**. Destructive tests that touch the DOM or local storage
  clean up their resources where possible.
- **Local logging is best-effort, not infallible.** The per-test **start marker** is written
  before the test runs (and, for destructive tests, its IndexedDB write is awaited to better
  protect it), but **each result is saved asynchronously**, so a brutal crash can still lose the
  last result(s). The local-server `fsync` path is the strongest guarantee when available.
- For deep memory diagnostics, use an **instrumented** WebKit on a PC.

## Project structure

```
index.html            single-page app (Dashboard / Categories / History / About tabs)
tests.html            redirect to index.html
css/styles.css        styles (dark, animated, game-pad-friendly focus)
api/save-log.php      optional PHP endpoint: save a report/log into logs/ (InfinityFree-compatible)
api/log-stream.php    optional PHP endpoint: append continuous log into logs/
js/core/log.js        central log: events, errors, durations
js/core/features.js   environment + feature detection
js/core/guard.js      resource guards: deadline, memory budget, abort
js/core/runner.js     harness: registration, non-blocking execution, classification
js/core/export.js     report building/export (JSON / text / ultra-detailed text)
js/core/store.js      local session persistence (IndexedDB, no server) + crash detection
js/core/serverlog.js  optional continuous logging to the local server (fsync)
js/tests/*.js         the test suites (one file per area)
js/app.js             UI orchestration and rendering
```

## Adding a test

```js
PSWKT.runner.register({
  id: 'my.category.my-test',        // unique id
  name: 'Readable name',
  category: 'typedarrays',          // existing category (see defineCategory)
  description: 'What the test checks.',
  requires: ['typedArrays.Float64Array'], // feature prerequisites (otherwise: skip)
  run: function (ctx) {
    // ctx.tick() inside loops to respect the deadline + Stop
    // ctx.charge(bytes) before allocating to respect the memory budget
    return { status: 'pass', detail: '...', measurements: { /* numbers */ } };
  }
});
```
