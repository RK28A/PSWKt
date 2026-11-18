/*
 * PSWKT - Tests : DOM
 * Techniques : manipulation hors-document (non destructif), DocumentFragment par lots,
 * dispatch d'evenements synthetiques, MutationObserver asynchrone.
 * Tout se passe dans un conteneur detache : la page visible n'est pas modifiee.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var G = PSWKT.guard;

  R.defineCategory('dom', 'DOM', 'Element creation, DocumentFragment, selectors, events, observers.');

  function detachedHost() {
    var d = document.createElement('div'); // jamais insere dans le document visible
    return d;
  }

  // 1) Creation et insertion par lot via DocumentFragment (mesure de debit).
  R.register({
    id: 'dom.fragment.batch',
    name: 'DocumentFragment (insertion par lot)',
    category: 'dom',
    description: 'Compare l insertion de 2000 noeuds un a un vs via DocumentFragment.',
    requires: ['dom.createElement', 'dom.DocumentFragment'],
    run: function (ctx) {
      var N = 2000;
      // Methode A : insertion directe repetee
      var hostA = detachedHost();
      var tA = PSWKT.now();
      for (var i = 0; i < N; i++) {
        var li = document.createElement('span');
        li.textContent = 'n' + i;
        hostA.appendChild(li);
        if ((i & 0x1FF) === 0) ctx.tick(0x1FF);
      }
      var dA = PSWKT.now() - tA;
      ctx.info('insertion directe : ' + Math.round(dA * 100) / 100 + ' ms');
      // Methode B : fragment puis une insertion
      var hostB = detachedHost();
      var tB = PSWKT.now();
      var frag = document.createDocumentFragment();
      for (var k = 0; k < N; k++) {
        var s = document.createElement('span');
        s.textContent = 'n' + k;
        frag.appendChild(s);
        if ((k & 0x1FF) === 0) ctx.tick(0x1FF);
      }
      hostB.appendChild(frag);
      var dB = PSWKT.now() - tB;
      ctx.info('fragment : ' + Math.round(dB * 100) / 100 + ' ms');
      var ok = (hostA.childNodes.length === N && hostB.childNodes.length === N);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'direct ' + Math.round(dA) + ' ms vs fragment ' + Math.round(dB) + ' ms (' + N + ' noeuds)',
        measurements: { n: N, directMs: Math.round(dA * 100) / 100, fragmentMs: Math.round(dB * 100) / 100 }
      };
    }
  });

  // 2) querySelector / querySelectorAll sur un sous-arbre detache.
  R.register({
    id: 'dom.selectors',
    name: 'Selecteurs CSS (querySelector)',
    category: 'dom',
    description: 'Builds a tree and checks various selectors.',
    requires: ['dom.querySelector'],
    run: function (ctx) {
      var host = detachedHost();
      host.innerHTML = '<ul class="list">' +
        '<li class="item" data-k="1">a</li>' +
        '<li class="item active" data-k="2">b</li>' +
        '<li class="item" data-k="3">c</li></ul>';
      var all = host.querySelectorAll('.item');
      var active = host.querySelector('li.active');
      var byAttr = host.querySelector('[data-k="3"]');
      var nth = host.querySelectorAll('li:nth-child(2)');
      ctx.info('.item -> ' + all.length + ', li.active -> ' + (active ? active.textContent : 'nul') + ', [data-k=3] -> ' + (byAttr ? byAttr.textContent : 'nul'));
      var ok = (all.length === 3 && active && active.textContent === 'b' && byAttr && byAttr.textContent === 'c' && nth.length === 1);
      return {
        status: ok ? 'pass' : 'fail',
        detail: '.item=' + all.length + ', active=' + (active && active.textContent) + ', nth-child(2)=' + nth.length,
        measurements: { items: all.length, active: active && active.textContent, byAttr: byAttr && byAttr.textContent, nth2: nth.length }
      };
    }
  });

  // 3) classList et dataset.
  R.register({
    id: 'dom.classlist.dataset',
    name: 'classList & dataset',
    category: 'dom',
    description: 'Checks add/remove/toggle/contains and dataset access.',
    requires: ['dom.classList', 'dom.dataset'],
    run: function (ctx) {
      var e = document.createElement('div');
      e.classList.add('a', 'b');
      e.classList.toggle('c');        // ajoute c
      e.classList.toggle('a');        // retire a
      var hasB = e.classList.contains('b');
      var hasA = e.classList.contains('a');
      e.dataset.userId = '42';
      e.dataset.flagName = 'actif';
      ctx.info('classes finales : ' + e.className + ' | data-user-id=' + e.getAttribute('data-user-id'));
      var ok = (hasB && !hasA && e.classList.contains('c') && e.getAttribute('data-user-id') === '42' && e.dataset.flagName === 'actif');
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'className="' + e.className + '", dataset.userId=' + e.dataset.userId,
        measurements: { className: e.className, hasA: hasA, hasB: hasB, userId: e.dataset.userId }
      };
    }
  });

  // 4) Evenements synthetiques (dispatchEvent + listener).
  R.register({
    id: 'dom.events',
    name: 'Events (dispatch + listener)',
    category: 'dom',
    description: 'Registers a listener, dispatches an event, checks propagation.',
    requires: ['dom.addEventListener'],
    run: function (ctx) {
      var parent = document.createElement('div');
      var child = document.createElement('button');
      parent.appendChild(child);
      var log = [];
      parent.addEventListener('click', function () { log.push('parent(bubble)'); }, false);
      parent.addEventListener('click', function () { log.push('parent(capture)'); }, true);
      child.addEventListener('click', function () { log.push('child'); }, false);
      var ev;
      try { ev = new global.Event('click', { bubbles: true, cancelable: true }); }
      catch (e) {
        ev = document.createEvent('Event');
        ev.initEvent('click', true, true);
      }
      child.dispatchEvent(ev);
      ctx.info('ordre des handlers : ' + log.join(' -> '));
      // capture avant cible avant bubble
      var ok = (log[0] === 'parent(capture)' && log.indexOf('child') < log.indexOf('parent(bubble)'));
      return {
        status: ok ? 'pass' : 'fail',
        detail: log.join(' -> '),
        measurements: { order: log }
      };
    }
  });

  // 5) MutationObserver (asynchrone) : detection d'ajout de noeud.
  R.register({
    id: 'dom.mutationobserver',
    name: 'MutationObserver',
    category: 'dom',
    description: 'Observes a detached container and confirms notification of an addition.',
    requires: ['dom.MutationObserver'],
    run: function (ctx) {
      var host = detachedHost();
      var p = new Promise(function (resolve) {
        var obs = new global.MutationObserver(function (mutations) {
          var added = 0;
          for (var i = 0; i < mutations.length; i++) added += mutations[i].addedNodes.length;
          obs.disconnect();
          ctx.info('mutation detectee : ' + added + ' noeud(s) ajoute(s)');
          resolve(added);
        });
        obs.observe(host, { childList: true });
        host.appendChild(document.createElement('p')); // declenche l'observer
      }).then(function (added) {
        var ok = (added >= 1);
        return { status: ok ? 'pass' : 'fail', detail: 'noeuds ajoutes notifies=' + added, measurements: { addedNodes: added } };
      });
      return G.withTimeout(p, Math.min(2000, ctx.budget.timeLeftMs()), 'MutationObserver');
    }
  });

})(typeof window !== 'undefined' ? window : this);
