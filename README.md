# PSWKT — Laboratoire de tests WebKit (PS5 13.60)

Application web de **diagnostic d'API JavaScript**, conçue pour tourner dans un navigateur
WebKit — notamment celui de la PS5 (13.60) — comme dans n'importe quel navigateur moderne.
Du **sondage doux et reproductible** (ce qui est réellement disponible, comment les API se
comportent) jusqu'au **stress test agressif** qui pousse le moteur **jusqu'à la rupture**.
Aucune dépendance, aucun build : des fichiers HTML/CSS/JS statiques.

## Ce que ça fait

- **Détection d'environnement et de fonctionnalités** : vérifie ce qui est *réellement*
  disponible (tableaux typés, Canvas/WebGL, Proxy/Map/Set, WeakRef, `performance.memory`,
  WebAssembly…). Les tests dont un prérequis manque sont automatiquement **ignorés**.
- **912 tests indépendants** répartis en **25 catégories**, avec des *techniques variées*
  (synchrone, asynchrone/Promise, Web Worker, microtâches, `requestAnimationFrame`,
  sondage par `try/catch`, timing haute résolution, génération pilotée par données,
  **fuzzing d'entrées malformées** et **stress test agressif/destructif**).

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

  Catégories de **fuzzing** (entrées *mal formées* / adversariales, pour pousser les API
  à leurs limites — **non destructif, borné, et reproductible par *seed***) :
  - `Fuzz · parseurs` — `JSON.parse`, `Number`/`parseInt`/`parseFloat`, `Date`, URI
    (`decodeURIComponent`…), `RegExp` : JSON tronqué, surrogates isolées, séquences `%XX`
    illégales, motifs invalides, et **backtracking (ReDoS) borné** sur entrées très courtes.
    Inclut des **invariants d'aller-retour** (`parse(stringify(x)) == x`,
    `decode(encode(x)) == x`) qui détectent les vrais écarts.
  - `Fuzz · natifs JS` — `String`/`Array`/`Object`/`Math` nourris d'index absurdes
    (négatifs, `NaN`, `Infinity`, `2^32`) et d'**objets-pièges** dont `valueOf`/`toString`/
    `@@toPrimitive` lèvent ou mentent, pour éprouver la coercition d'arguments.
  - `Fuzz · tableaux typés` — `ArrayBuffer`/`TypedArray`/`DataView` avec tailles, offsets
    et indices **hors bornes** ; vérifie que l'accès hors limites reste *inoffensif*
    (jamais de corruption mémoire) et que `Uint8ClampedArray` borne correctement.
  - `Fuzz · structures & pièges` — imbrication profonde, **cycles**, **Proxy à trappes
    hostiles** (qui lèvent ou violent les invariants), itérateurs piégés, `structuredClone`,
    `Map`/`Set` à clés limites (`NaN`, `±0`).

  Catégorie de **robustesse / découverte de plantages** (états d'API fragiles, connus
  pour être crash-prone dans d'anciens WebKit — classe de bug annotée factuellement) :
  - `Fuzz · robustesse / crash` — **buffer détaché** (usage après transfert), **vue sur
    ArrayBuffer redimensionné**, **mutation pendant itération** (Array/Map/Set + collections
    DOM vivantes), `structuredClone` de graphes exotiques, **DOM massif** (arbre profond/large),
    **innerHTML géant/malformé**, **canvas géant** + `getImageData` absurde, **épuisement WebGL**
    (buffers/textures/contextes), récursion indirecte (coercition/Proxy), `JSON.parse` reviver
    hostile, **Workers en masse**, tableaux à trous extrêmes. Les tests qui peuvent figer/planter
    sont destructifs ; ils **journalisent leur progression avant chaque palier risqué**.

  Catégorie de **stress test agressif** (⚠ *destructif* — pousse jusqu'à la **rupture**) :
  - `Fuzz · AGRESSIF (destructif)` — bombe mémoire (allocation retenue jusqu'à l'OOM),
    chaîne et tableau typé géants, débordement de pile par récursion, imbrication JSON
    jusqu'au débordement, **backtracking regex catastrophique** (peut *figer l'onglet*),
    et churn GC. Ces tests **peuvent figer ou faire planter le navigateur** — c'est le but :
    on observe si le WebKit de la PS5 tient, rame, se recharge seul ou plante, et chaque
    test **journalise sa progression avant de pousser plus loin** (pour qu'un log sauvegardé
    montre jusqu'où le moteur a tenu, même s'il plante juste après).

  > **Deux régimes.** Le fuzzing *ordinaire* (4 catégories ci-dessus) reste **borné et
  > reproductible** : chaque entrée est encadrée par `try/catch`, chaque taille est
  > **plafonnée**, chaque boucle appelle `ctx.tick()` (échéance + Stop), l'aléatoire est
  > **semé**. Un test y *réussit* quand le moteur **survit** ; il *échoue* si un **invariant**
  > est violé. Le stress *agressif* (catégorie `AGRESSIF`) **ignore volontairement** ces
  > garde-fous pour atteindre le point de rupture.
  >
  > **Aucun danger pour la console.** Le navigateur de la PS5 est en bac-à-sable : aucun
  > code JavaScript ne peut abîmer le matériel ni le firmware. Au pire l'onglet meurt et la
  > **PS5 redémarre normalement**. Rien de persistant n'est écrit.
- **Annotations** : sur chaque résultat, une étiquette rapide (OK / Lent / Figé /
  Rechargé / Autre) et une note libre. Pratique pour consigner un comportement observé
  sur la console (ex. « a fait recharger le navigateur »). Les annotations sont reprises
  dans le rapport exporté (JSON et texte). L'outil reste **non destructif** : il n'essaie
  pas de provoquer de plantage, il te laisse noter ce que *tu* observes.
- **Journal en direct, ultra-détaillé** : chaque test écrit son début, ses sous-étapes, ses
  **mesures** complètes, l'évolution du tas et sa fin ; les erreurs JS globales (avec pile)
  y figurent aussi. Boutons **Copier le journal**, **Télécharger (.txt)** et
  **⤓ Journal DÉTAILLÉ sur le serveur (.txt)** (dump complet : mesures intégrales, piles,
  tas avant/après, budget, annotations).
- **Enregistrement CONTINU sur le serveur (anti-perte sur crash)** 🔴 — case cochée par
  défaut. Le journal est envoyé au serveur **au fur et à mesure** et écrit sur disque
  (`fsync`) à chaque réception, dans `logs/pswkt-live-<session>.txt`. Avant chaque test,
  un marqueur **`▶ DEBUT <id>`** est persisté *avant* son exécution : **si le navigateur
  PS5 plante en plein test, le fichier contient tout jusqu'au test fautif, et sa dernière
  ligne `▶ DEBUT` nomme le test qui a fait tomber WebKit.** Les tests agressifs persistent
  aussi leurs paliers (`ctx.flush()`) avant chaque étape risquée. Nécessite `python3 server.py`.
- **Garde-fous de ressources** : échéance par test, budget mémoire (Mo), plafond
  d'itérations, délai maximal pour les tests asynchrones, et un bouton **Stop** coopératif.
  Ils cadrent les tests *ordinaires*. La case **« Mode agressif »** (cochée par défaut)
  autorise les tests **destructifs** qui ignorent ces plafonds pour pousser jusqu'à la
  rupture ; décochez-la pour un diagnostic doux et toujours interruptible.
- **Export** : rapport **JSON** complet + version **texte** lisible, avec trois voies de
  récupération (téléchargement, presse-papiers, zone de texte sélectionnable).

## Lancer sur PC

Deux options :

**Option A — avec enregistrement serveur des logs (recommandé).**
Lance le petit serveur fourni : il sert la page *et* enregistre les rapports/journaux
envoyés par le bouton « Enregistrer sur le serveur » dans un dossier `logs/`, créé
automatiquement au démarrage (réutilisé s'il existe déjà).

```bash
cd PSWKt
python3 server.py        # port 8080 par défaut, ou : python3 server.py 9000
```

**Option B — simple fichier statique (pas d'enregistrement serveur).**

```bash
cd PSWKt
python3 -m http.server 8080
```

Puis ouvre `http://localhost:8080/`.

## Lancer sur la PS5

1. Sur le PC, lance `python3 server.py` (option A) et note l'adresse IP locale du PC
   (ex. `192.168.1.20`).
2. Sur la PS5, ouvre le navigateur et va sur `http://192.168.1.20:8080/`.
3. Choisis une catégorie (ou « Tout lancer »), observe les résultats en direct, annote
   ce que tu veux consigner.
4. **Chasse aux plantages (recommandé)** : laisse **« Enregistrement continu sur le serveur »**
   coché. Le journal s'écrit en direct dans `PSWKt/logs/pswkt-live-<session>.txt` **sur le PC**.
   Si WebKit plante, rouvre ce fichier : la **dernière ligne `▶ DEBUT ...`** nomme le test fautif,
   et tout le détail de ce qui précède est déjà sauvegardé. Pour isoler un crasheur, lance les
   tests destructifs **un par un** (bouton « Lancer » de chaque test) plutôt que « Tout lancer ».
5. **Pour garder les logs sans galère** : « ⤓ Journal DÉTAILLÉ sur le serveur (.txt) » écrit un
   dump complet dans `PSWKt/logs/` — rien à copier-coller depuis la PS5. Le bouton « Copier le
   journal » reste disponible (mais le presse-papiers de la PS5 est capricieux : préfère le serveur).

## Structure

```
server.py             serveur local : statique + enregistrement dans logs/ (ponctuel ET continu/fsync)
index.html            page principale + interface
css/styles.css        styles
js/core/log.js        journal : événements, erreurs, durées
js/core/features.js   détection environnement + fonctionnalités
js/core/guard.js      garde-fous : échéance, budget mémoire, arrêt
js/core/runner.js     harnais : enregistrement, exécution non bloquante
js/core/export.js     construction et export du rapport (JSON/texte/texte ULTRA-DETAILLE)
js/core/serverlog.js  enregistrement CONTINU sur le serveur (anti-perte sur crash, fsync)
js/tests/typedarrays.js  canvas.js  objects.js  memory.js
js/tests/strings.js      numbers.js errors.js  async.js  platform.js  dom.js
js/tests/_fuzz.js        infrastructure de fuzzing (PRNG semé, corpus malformés, fabriques)
js/tests/fuzz_parsers.js fuzz_builtins.js fuzz_typedarrays.js fuzz_structural.js
js/tests/fuzz_robustness.js  robustesse/crash (buffer détaché, mutation/itération, DOM/canvas/WebGL…)
js/tests/fuzz_aggressive.js  stress test AGRESSIF/destructif (bombe mémoire, regex, pile…)
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

Une erreur JavaScript observée ici est un **comportement à documenter**, pas une
vulnérabilité. Le **fuzzing ordinaire** envoie des entrées *mal formées* pour cartographier
la robustesse des API (coercition, hors-bornes, cycles…) en restant borné et capturé.
Le **stress test agressif** (`Mode agressif`) va plus loin : il cherche *délibérément* le
point de rupture et **peut figer ou faire planter le navigateur**. C'est assumé et sans
risque pour la console — le navigateur PS5 est en **bac-à-sable** : au pire l'onglet meurt
et la **PS5 redémarre** (rien de persistant n'est écrit, le matériel et le firmware sont hors
d'atteinte du JavaScript). Pour des diagnostics mémoire approfondis, utilisez un WebKit
**instrumenté** sur PC.
