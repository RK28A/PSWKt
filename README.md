# PSWKT — Laboratoire de tests WebKit (PS5 13.60)

Application web de **diagnostic d'API JavaScript**, non destructive et reproductible,
conçue pour tourner dans un navigateur WebKit — notamment celui de la PS5 (13.60) — comme
dans n'importe quel navigateur moderne. Aucune dépendance, aucun build : des fichiers
HTML/CSS/JS statiques.

## Ce que ça fait

- **Détection d'environnement et de fonctionnalités** : vérifie ce qui est *réellement*
  disponible (tableaux typés, Canvas/WebGL, Proxy/Map/Set, WeakRef, `performance.memory`,
  WebAssembly…). Les tests dont un prérequis manque sont automatiquement **ignorés**.
- **860+ tests indépendants** répartis en **19 catégories**, avec des *techniques variées*
  (synchrone, asynchrone/Promise, Web Worker, microtâches, `requestAnimationFrame`,
  sondage par `try/catch`, timing haute résolution, génération pilotée par données).

  Catégories comportementales (exercent réellement l'API) :
  - `Tableaux typés` — aller-retour par type, DataView/endianness, vues partagées,
    accès hors limites, allocation progressive sous budget, débit séquentiel.
  - `Canvas & graphismes` — remplissage + relecture de pixels, composition alpha,
    aller-retour `ImageData`, débit de remplissage, sondage WebGL.
  - `Objets & structures` — `Object.freeze`, Map/Set, Proxy/Reflect, JSON,
    `structuredClone`, création massive d'objets.
  - `Allocations & mémoire` — lecture du tas, cycle allocation/libération,
    WeakRef, rotation d'allocations (churn), construction de grande chaîne.
  - `Chaînes & texte` — Unicode hors BMP, normalisation NFC/NFD, regex avancées
    (sondées), TextEncoder/TextDecoder, base64, construction concat vs join.
  - `Nombres & arithmétique` — précision IEEE-754, entiers sûrs, BigInt, Math,
    opérations bit à bit, analyse de nombres.
  - `Erreurs & exceptions` — try/catch/finally, types d'erreurs natifs, pile d'appels,
    sous-classes d'`Error`, rejets de promesses (tous **capturés et documentés**).
  - `Asynchronisme` — ordre microtâches/macrotâches, dérive de `setTimeout`,
    cadence `requestAnimationFrame` (FPS), `async/await` + `Promise.all`, `queueMicrotask`.
  - `Plateforme & API` — Web Worker (aller-retour via Blob), WebAssembly (module `add`),
    `crypto.getRandomValues`, SHA-256 (`crypto.subtle`), localStorage, Intl.
  - `DOM` — DocumentFragment par lot, sélecteurs CSS, classList/dataset,
    événements synthétiques, MutationObserver.
  - `Profil PS5 / WebKit` — version WebKit, GPU démasqué, écran/HDR/gamut,
    résolution de `performance.now`, capacités `navigator`, quirks WebKit.

  Catégories de **sondes massives** (cartographie du support, non destructif —
  réussi = supporté, ignoré = absent), générées par tables de données :
  - `Natifs JS (méthodes)` — ~230 membres de Array/String/Object/Math/Date/JSON/…
  - `Objets globaux & API Web` — ~110 constructeurs et API exposés.
  - `CSS (CSS.supports)` — ~115 propriétés/valeurs modernes (grid, oklch, :has()…).
  - `Canvas 2D (API)` — ~55 membres du contexte 2D.
  - `WebGL (capacités)` — extensions + limites matérielles du GPU.
  - `Média & codecs` — matrice `canPlayType` audio/vidéo (AVC, HEVC, AV1, VP9, Opus…).
  - `Entrées & manette` — Gamepad/DualSense, pointeur, clavier, plein écran, vibration.
  - `Syntaxe ECMAScript` — ~45 constructions du langage (classes, `?.`, `??=`, champs privés…).
- **Annotations** : sur chaque résultat, une étiquette rapide (OK / Lent / Figé /
  Rechargé / Autre) et une note libre. Pratique pour consigner un comportement observé
  sur la console (ex. « a fait recharger le navigateur »). Les annotations sont reprises
  dans le rapport exporté (JSON et texte). L'outil reste **non destructif** : il n'essaie
  pas de provoquer de plantage, il te laisse noter ce que *tu* observes.
- **Journal en direct, copiable** : chaque test écrit son début, ses sous-étapes, ses
  **mesures**, l'évolution du tas et sa fin ; les erreurs JS globales y figurent aussi.
  Boutons **Copier le journal** (presse-papiers + zone sélectionnable) et
  **Télécharger (.txt)** — pensés pour la console où le téléchargement peut échouer.
- **Garde-fous de ressources** : échéance par test, budget mémoire (Mo), plafond
  d'itérations, délai maximal pour les tests asynchrones, et un bouton **Stop** coopératif
  pour ne jamais bloquer le navigateur.
- **Export** : rapport **JSON** complet + version **texte** lisible, avec trois voies de
  récupération (téléchargement, presse-papiers, zone de texte sélectionnable).

## Lancer sur PC

Servez le dossier en HTTP (les `file://` fonctionnent aussi, mais HTTP est plus fiable
pour le presse-papiers) :

```bash
cd PSWKt
python3 -m http.server 8080
```

Puis ouvrez `http://localhost:8080/`.

## Lancer sur la PS5

1. Sur le PC, lancez le serveur ci-dessus et notez l'adresse IP locale du PC
   (ex. `192.168.1.20`).
2. Sur la PS5, ouvrez le navigateur et allez sur `http://192.168.1.20:8080/`.
3. Choisissez une catégorie (ou « Tout lancer »), observez les résultats en direct.
4. Section **6. Export** : générez le rapport, puis sélectionnez la zone de texte et
   copiez-la (ou utilisez le téléchargement s'il fonctionne) pour l'analyser sur PC.

## Structure

```
index.html            page principale + interface
css/styles.css        styles
js/core/log.js        journal : événements, erreurs, durées
js/core/features.js   détection environnement + fonctionnalités
js/core/guard.js      garde-fous : échéance, budget mémoire, arrêt
js/core/runner.js     harnais : enregistrement, exécution non bloquante
js/core/export.js     construction et export du rapport (JSON/texte)
js/tests/typedarrays.js  canvas.js  objects.js  memory.js
js/tests/strings.js      numbers.js errors.js  async.js  platform.js  dom.js
js/app.js             orchestration et rendu de l'interface
```

## Ajouter un test

```js
PSWKT.runner.register({
  id: 'ma.categorie.mon-test',     // identifiant unique
  name: 'Nom lisible',
  category: 'typedarrays',          // catégorie existante (voir defineCategory)
  description: 'Ce que le test vérifie.',
  requires: ['typedArrays.Float64Array'], // prérequis de fonctionnalités (sinon : skip)
  run: function (ctx) {
    // ctx.tick() dans les boucles pour respecter échéance + Stop
    // ctx.charge(bytes) avant d'allouer pour respecter le budget mémoire
    return { status: 'pass', detail: '...', measurements: { /* chiffres */ } };
  }
});
```

## Portée et prudence

Tests **reproductibles et non destructifs** uniquement. Une erreur JavaScript observée
ici est un **comportement à documenter**, pas une vulnérabilité. Pour des diagnostics
mémoire approfondis, utilisez un WebKit **instrumenté** sur PC.
