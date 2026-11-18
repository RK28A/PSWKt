/*
 * PSWKT - Tests : objets, structures et semantique du langage
 * Proxy, Map/Set, Object.freeze, JSON, Symbol, structuredClone...
 * Reproductibles et non destructifs.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;

  R.defineCategory('objects', 'Objets & structures', 'Semantique des objets : Proxy, Map/Set, freeze, JSON, clonage.');

  // 1) Proprietes, descripteurs et Object.freeze.
  R.register({
    id: 'obj.freeze',
    name: 'Object.freeze et immuabilite',
    category: 'objects',
    description: 'Verifie qu un objet gele reste inchange (la mutation leve en strict, est ignoree en non-strict).',
    requires: ['objects.ObjectFreeze'],
    run: function (ctx) {
      var o = { a: 1, b: 2 };
      Object.freeze(o);
      ctx.tick();
      var frozen = Object.isFrozen(o);
      // En mode strict, muter un objet gele leve une TypeError ; en non-strict, c'est ignore.
      // L'invariant teste est le meme dans les deux cas : l'objet ne change pas.
      var threwOnWrite = false, threwOnDelete = false;
      try { o.a = 99; } catch (e) { threwOnWrite = true; }
      try { o.c = 3; } catch (e) { threwOnWrite = true; }
      try { delete o.b; } catch (e) { threwOnDelete = true; }
      var unchanged = (o.a === 1 && o.b === 2 && o.c === undefined);
      var ok = frozen && unchanged;
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'isFrozen=' + frozen + ', inchange=' + unchanged +
          ', mutation ' + (threwOnWrite ? 'rejetee (strict)' : 'ignoree (non-strict)'),
        measurements: { frozen: frozen, unchanged: unchanged, threwOnWrite: threwOnWrite, threwOnDelete: threwOnDelete }
      };
    }
  });

  // 2) Map / Set : insertion, ordre, taille, cles objet.
  R.register({
    id: 'obj.mapset',
    name: 'Map / Set',
    category: 'objects',
    description: 'Verifie l unicite, l ordre d insertion et les cles non primitives.',
    requires: ['objects.Map', 'objects.Set'],
    run: function (ctx) {
      var m = new Map();
      var keyObj = {};
      m.set('x', 1); m.set('x', 2); m.set(keyObj, 'obj'); m.set(42, 'n');
      var set = new Set([1, 1, 2, 2, 3]);
      ctx.tick();
      var order = [];
      m.forEach(function (v, k) { order.push(typeof k === 'object' ? 'obj' : k); });
      var ok = (m.size === 3 && m.get('x') === 2 && m.get(keyObj) === 'obj' && set.size === 3 &&
        order.join(',') === 'x,obj,42');
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'Map.size=' + m.size + ', Set.size=' + set.size + ', ordre=' + order.join(','),
        measurements: { mapSize: m.size, setSize: set.size, order: order }
      };
    }
  });

  // 3) Proxy / Reflect : interception des acces.
  R.register({
    id: 'obj.proxy',
    name: 'Proxy et interception',
    category: 'objects',
    description: 'Compte les lectures interceptees par un piege get.',
    requires: ['objects.Proxy'],
    run: function (ctx) {
      var reads = 0;
      var target = { value: 7 };
      var p = new Proxy(target, {
        get: function (t, prop, recv) {
          reads++;
          if (typeof Reflect !== 'undefined') return Reflect.get(t, prop, recv);
          return t[prop];
        }
      });
      ctx.tick();
      var a = p.value, b = p.value, c = p.missing;
      var ok = (a === 7 && b === 7 && c === undefined && reads === 3);
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'lectures interceptees=' + reads + ' (attendu 3), value=' + a,
        measurements: { reads: reads, value: a, missing: c }
      };
    }
  });

  // 4) JSON : fidelite aller-retour (y compris cas limites).
  R.register({
    id: 'obj.json',
    name: 'JSON aller-retour',
    category: 'objects',
    description: 'Serialise/deserialise des structures imbriquees et verifie la fidelite.',
    requires: [],
    run: function (ctx) {
      var original = {
        n: 123.456, s: 'chaine avec accents: eàü', b: true, z: null,
        arr: [1, 2, [3, 4], { k: 'v' }],
        nested: { deep: { deeper: [true, false, 0] } },
        unicode: 'é€😀'
      };
      var str = JSON.stringify(original);
      var back = JSON.parse(str);
      ctx.tick();
      var ok = (JSON.stringify(back) === str &&
        back.arr[2][1] === 4 && back.nested.deep.deeper[0] === true &&
        back.unicode === original.unicode);
      return {
        status: ok ? 'pass' : 'fail',
        detail: ok ? 'fidelite confirmee (' + str.length + ' octets)' : 'divergence apres aller-retour',
        measurements: { length: str.length, fidelity: ok }
      };
    }
  });

  // 5) structuredClone (si disponible) : copie profonde independante.
  R.register({
    id: 'obj.structuredclone',
    name: 'structuredClone',
    category: 'objects',
    description: 'Clone profond ; verifie l independance et la copie des types riches.',
    requires: ['objects.structuredClone'],
    run: function (ctx) {
      var src = { arr: new Uint8Array([1, 2, 3]), map: new Map([['a', 1]]), nested: { x: [1, 2] } };
      var clone = global.structuredClone(src);
      ctx.tick();
      clone.nested.x.push(3);
      var independent = (src.nested.x.length === 2 && clone.nested.x.length === 3);
      var typesOk = (clone.arr instanceof Uint8Array && clone.arr[1] === 2 &&
        clone.map instanceof Map && clone.map.get('a') === 1);
      var ok = independent && typesOk;
      return {
        status: ok ? 'pass' : 'fail',
        detail: 'independance=' + independent + ', types riches=' + typesOk,
        measurements: { independent: independent, typesOk: typesOk }
      };
    }
  });

  // 6) Creation massive d'objets sous budget (gestion des allocations).
  R.register({
    id: 'obj.alloc.many',
    name: 'Creation massive d objets',
    category: 'objects',
    description: 'Cree un grand nombre de petits objets sous budget et mesure le debit.',
    requires: [],
    run: function (ctx) {
      // Estimation prudente : ~64 octets par petit objet (approximation documentee).
      var approxBytesPerObj = 64;
      var target = Math.min(500000, Math.floor(ctx.budget.remainingBytes() / approxBytesPerObj));
      var bag = new Array(target);
      var t0 = PSWKT.now();
      for (var i = 0; i < target; i++) {
        bag[i] = { id: i, tag: 'o' + (i & 255), flag: (i & 1) === 0 };
        if ((i & 0xFFFF) === 0) ctx.tick(0xFFFF);
      }
      var dt = PSWKT.now() - t0;
      // Verifie quelques elements puis libere.
      var sample = (bag[0].id === 0 && bag[target - 1].id === target - 1);
      bag.length = 0;
      return {
        status: sample ? 'pass' : 'fail',
        detail: target + ' objets crees en ' + Math.round(dt) + ' ms (echantillon ' + (sample ? 'ok' : 'ko') + ')',
        measurements: {
          objects: target, ms: Math.round(dt * 100) / 100,
          objPerSec: dt > 0 ? Math.round(target / (dt / 1000)) : null,
          approxBytes: target * approxBytesPerObj
        }
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
