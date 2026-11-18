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
  aussi leurs paliers (`ctx.flush()`) avant chaque étape risquée. *Option serveur* : nécessite
  `python3 server.py` (garantie la plus forte grâce à `fsync`).
- **Historique des sessions, SANS serveur (IndexedDB)** 💾 — **chaque lancement crée une
  nouvelle session** enregistrée **localement dans le navigateur** (IndexedDB, repli
  mémoire/localStorage). Fonctionne sur un **hébergement statique** (InfinityFree…), sans
  aucun serveur. On peut **consulter, exporter (JSON / TXT détaillé), comparer** plusieurs
  sessions (compteurs côte à côte) et les supprimer. **Détection de crash sans serveur** :
  avant chaque test, un marqueur « test en cours » est écrit dans IndexedDB ; si le navigateur
  plante, **au rechargement une bannière nomme le dernier test lancé** (le crasheur probable).
  *(Honnête : IndexedDB écrit de façon asynchrone — fiable dans l'immense majorité des cas,
  mais sans garantie absolue sur un gel brutal ; le serveur `fsync` reste la voie la plus sûre.)*
- **Recherche & filtres** dans les résultats : par nom/id/détail et par statut (réussis,
  échecs, erreurs, arrêtés, ignorés).
- **Deux modes** : *diagnostic* (par défaut, doux, interruptible) et *stress* (case « Mode
  agressif », opt-in, peut figer/planter). Le mode est enregistré avec chaque session.
- **Garde-fous de ressources** : échéance par test, budget mémoire (Mo), plafond
  d'itérations, délai maximal pour les tests asynchrones, et un bouton **Stop** coopératif.
  Ils cadrent les tests *ordinaires*. La case **« Mode agressif »** (**décochée par défaut**,
  par sécurité) autorise les tests **destructifs** qui ignorent ces plafonds pour pousser
  jusqu'à la rupture. Sur l'**accueil**, cocher « Mode agressif » **affiche la liste des tests
  agressifs** (toutes cases décochées) : tu choisis individuellement ceux à lancer — « Tout
  lancer » exécute alors le diagnostic + uniquement les agressifs cochés.
- **Classification des résultats** : chaque résultat est classé (Conforme / Comportement
  incorrect / Exception JavaScript / Délai dépassé / Interrompu / Fonctionnalité indisponible /
  Non exécuté), affiché par ligne et en répartition dans le résumé, et repris dans l'export.
- **Export** : rapport **JSON** complet + version **texte** lisible, avec trois voies de
  récupération (téléchargement, presse-papiers, zone de texte sélectionnable).

## Hébergement : 100 % statique (InfinityFree & co.)

**Aucun serveur n'est nécessaire.** L'application est entièrement HTML/CSS/JavaScript côté
navigateur. Les résultats sont persistés **localement** via **IndexedDB** (repli
mémoire/localStorage), et exportables en **JSON** et **TXT**. Elle fonctionne donc telle
quelle sur un hébergement statique gratuit comme **InfinityFree**.

**Interface — 2 pages :**
- `index.html` (**Accueil**) : épuré — un bouton **« Tout lancer »**, la progression, les
  résultats et la **console**. Rien d'autre.
- `tests.html` (**Catégories & test perso**) : le catalogue complet, les cases par test pour
  lancer **une sélection personnalisée**, l'historique des sessions et l'environnement détaillé.

**Déployer sur InfinityFree :**
1. Téléverse tout le dépôt (`index.html`, `tests.html`, `css/`, `js/`) dans `htdocs/`
   (gestionnaire de fichiers ou FTP).
2. Ouvre l'URL de ton site. C'est tout — pas de PHP, pas de base de données, pas de
   processus serveur, pas de cron.
3. Les sessions de test sont enregistrées dans **ton navigateur** (IndexedDB) et visibles
   dans la section « Historique des sessions ». Exporte-les en JSON/TXT pour les garder
   hors du navigateur.

> `server.py` (Python) est **optionnel** : il n'est utile qu'en local, pour l'enregistrement
> continu avec garantie disque (`fsync`). Il **n'est pas requis** et n'a pas sa place sur
> InfinityFree. L'appli est pleinement utilisable sans lui.

## Lancer en local (PC)

**Option A — simple fichier statique (suffit pour tout, y compris l'historique IndexedDB).**

```bash
cd PSWKt
python3 -m http.server 8080      # ou n'importe quel serveur statique
```

**Option B — avec enregistrement serveur continu des logs (bonus local, `fsync`).**
Le petit serveur fourni sert la page *et* enregistre les journaux (ponctuels et continus)
dans un dossier `logs/`, créé au démarrage.

```bash
cd PSWKt
python3 server.py        # port 8080 par défaut, ou : python3 server.py 9000
```

Puis ouvre `http://localhost:8080/`.

## Lancer sur la PS5

Depuis un site **InfinityFree** (ou tout hébergement statique) : ouvre simplement l'URL de ton
site dans le navigateur de la PS5. Ou, en local : lance un serveur statique sur le PC (ou
`python3 server.py`) et va sur `http://<IP-du-PC>:8080/`.

1. Choisis une catégorie (ou « Tout lancer »), observe les résultats en direct, annote.
2. **Chasse aux plantages — chemin sans serveur (IndexedDB).** Chaque lancement crée une
   session enregistrée dans le navigateur. Si WebKit plante, **recharge la page** : une
   bannière en haut **nomme le dernier test lancé** (le crasheur probable), et la session est
   consultable dans « Historique des sessions ». Pour isoler un crasheur, lance les tests
   destructifs **un par un** plutôt que « Tout lancer ». Exporte la session en **JSON/TXT**.
3. **Chemin serveur local (optionnel, trace la plus sûre).** Si tu passes par `python3 server.py`
   sur le PC, laisse **« Enregistrement continu sur le serveur »** coché : le journal s'écrit en
   direct (`fsync`) dans `PSWkt/logs/pswkt-live-<session>.txt` **sur le PC**, et sa dernière ligne
   `▶ DEBUT ...` nomme le test fautif. Le bouton « ⤓ Journal DÉTAILLÉ sur le serveur (.txt) »
   écrit un dump complet. (Sur InfinityFree, ce chemin serveur n'existe pas : utilise IndexedDB
   + export.)

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
js/core/store.js      persistance locale des sessions (IndexedDB, sans serveur) + detection de crash
js/core/serverlog.js  enregistrement CONTINU sur le serveur local optionnel (fsync)
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

## Architecture, nouveautés et limites

**Architecture.** 100 % navigateur : HTML/CSS/JS, aucune dépendance, aucun build. Noyau
(`js/core/`) = journal, détection de features, garde-fous, harnais d'exécution, export,
**persistance IndexedDB** et enregistrement serveur optionnel. Tests (`js/tests/`) enregistrés
par catégorie via `PSWKT.runner.register`. Les calculs se font côté client ; les données
restent locales (IndexedDB) et s'exportent en JSON/TXT.

**Nouveautés de cette version.**
- Persistance **IndexedDB** des sessions (repli mémoire/localStorage) → fonctionne sur
  hébergement statique (InfinityFree), **sans serveur**.
- **Une nouvelle session + journal propre à chaque lancement** ; historique consultable,
  exportable (JSON/TXT) et **comparable** (compteurs côte à côte).
- **Détection de crash sans serveur** : marqueur « test en cours » en IndexedDB → bannière
  au rechargement nommant le test fautif.
- **Logs ultra-détaillés** par test : action → déroulé (action/réaction) → verdict en clair,
  mesures intégrales, pile, Δ mémoire, budget.
- **Recherche & filtres** sur les résultats ; **deux modes** (diagnostic / stress).
- `server.py` (Python) rendu **optionnel** (bonus local `fsync`).

**Limites connues (honnêteté).**
- IndexedDB écrit de façon **asynchrone** : un gel/arrêt brutal *juste après* une écriture
  peut la perdre. C'est du meilleur effort (fiable en pratique, sans garantie absolue). La
  voie `fsync` du serveur local est plus sûre, mais indisponible sur InfinityFree.
- Les tests touchant au DOM/Canvas/WebGL ne peuvent pas être isolés en **Web Worker** ;
  l'isolation Worker n'a donc **pas** été généralisée (elle casserait ces catégories).
- Les résultats dépendent du **navigateur réel** : aucun test n'a été exécuté sur une vraie
  PS5 depuis cet environnement — la validation a été faite en Chromium/WebKit de bureau.
- Reprise automatique des tests non terminés : non implémentée (l'historique conserve le
  partiel ; on relance manuellement).

**Validation effectuée.** Contrôle de syntaxe de tous les scripts ; chargement de la page
sans erreur console ; suite complète **912 tests / 25 catégories** verte (867 réussis,
45 ignorés, 0 échec, 0 erreur) ; persistance IndexedDB, historique, filtres, comparaison et
**bannière de crash au rechargement** validés en navigateur headless ; fonctionnement **sans
PHP ni serveur Python** confirmé (chemin IndexedDB pur).

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
