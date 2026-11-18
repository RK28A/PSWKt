/*
 * PSWKT - Sondes : fonctionnalites CSS (via CSS.supports)
 * Cartographie le support CSS du moteur (mise en page, couleur, effets, requetes).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('css', 'CSS (CSS.supports)', 'Support des proprietes et valeurs CSS modernes.');

  // [propriete, valeur, libelle?]
  var PAIRS = [
    // Mise en page
    ['display', 'flex'], ['display', 'grid'], ['display', 'inline-grid'], ['display', 'contents'],
    ['display', 'flow-root'], ['gap', '10px'], ['row-gap', '10px'], ['column-gap', '10px'],
    ['aspect-ratio', '16 / 9'], ['grid-template-columns', 'subgrid'], ['grid-template-rows', 'masonry'],
    ['place-items', 'center'], ['place-content', 'center'], ['inset', '0'],
    ['position', 'sticky'], ['position', 'fixed'], ['float', 'inline-start'],
    ['writing-mode', 'vertical-rl'], ['direction', 'rtl'],
    ['container-type', 'inline-size'], ['container-name', 'a'], ['contain', 'layout'],
    ['content-visibility', 'auto'], ['overflow', 'clip'], ['overscroll-behavior', 'contain'],
    // Dimensionnement et unites
    ['width', 'min-content'], ['width', 'max-content'], ['width', 'fit-content(10px)'],
    ['width', 'clamp(1px, 2vw, 3px)'], ['width', 'calc(1px + 2px)'], ['width', '100dvh'],
    ['width', '100svh'], ['width', '100lvh'], ['height', '100cqh'], ['width', '1cqw'],
    ['width', 'min(1px, 2px)'], ['width', 'max(1px, 2px)'], ['gap', 'round(1px, 1px)'],
    // Couleur
    ['color', 'rgb(0 0 0 / 50%)'], ['color', 'hsl(0 0% 0% / 50%)'], ['color', 'hwb(0 0% 0%)'],
    ['color', 'lab(50% 40 59.5)'], ['color', 'lch(52.2% 72.2 50)'], ['color', 'oklab(0.4 0.1 0.1)'],
    ['color', 'oklch(0.4 0.1 20)'], ['color', 'color(display-p3 1 0 0)'], ['color', 'color-mix(in srgb, red, blue)'],
    ['color', 'rebeccapurple'], ['accent-color', 'red'], ['caret-color', 'red'],
    ['color-scheme', 'dark'], ['forced-color-adjust', 'none'],
    // Texte et polices
    ['text-wrap', 'balance'], ['text-wrap', 'pretty'], ['hyphens', 'auto'], ['tab-size', '4'],
    ['font-variation-settings', '"wght" 400'], ['font-feature-settings', '"liga" 1'],
    ['text-decoration-thickness', '2px'], ['text-underline-offset', '2px'], ['line-clamp', '2'],
    ['-webkit-line-clamp', '2'], ['text-emphasis', 'dot'], ['text-orientation', 'upright'],
    ['font-optical-sizing', 'auto'], ['text-align', 'justify'], ['white-space', 'break-spaces'],
    // Effets visuels
    ['filter', 'blur(2px)'], ['backdrop-filter', 'blur(2px)'], ['-webkit-backdrop-filter', 'blur(2px)'],
    ['mix-blend-mode', 'multiply'], ['background-blend-mode', 'multiply'], ['clip-path', 'circle(50%)'],
    ['mask', 'none'], ['-webkit-mask', 'none'], ['box-shadow', '0 0 1px red'], ['opacity', '0.5'],
    ['mask-image', 'none'], ['shape-outside', 'circle(50%)'],
    // Transformations et animations
    ['transform', 'translateX(1px)'], ['transform', 'rotate3d(1,1,1,45deg)'], ['transform-style', 'preserve-3d'],
    ['perspective', '100px'], ['transition', 'all 1s'], ['animation', 'x 1s'], ['will-change', 'transform'],
    ['offset-path', 'path("M0 0")'], ['scale', '1.2'], ['rotate', '45deg'], ['translate', '10px'],
    // Interaction / defilement
    ['scroll-behavior', 'smooth'], ['scroll-snap-type', 'x mandatory'], ['scroll-snap-align', 'center'],
    ['scroll-margin', '10px'], ['scroll-padding', '10px'], ['touch-action', 'manipulation'],
    ['user-select', 'none'], ['-webkit-user-select', 'none'], ['pointer-events', 'none'],
    ['overflow-anchor', 'none'], ['scrollbar-width', 'thin'], ['scrollbar-gutter', 'stable'],
    // Image et objets
    ['object-fit', 'cover'], ['object-position', 'center'], ['image-rendering', 'pixelated'],
    ['background-clip', 'text'], ['-webkit-background-clip', 'text'],
    // Fonctionnalites recentes / selecteurs
    ['selector(:has(a))', '', 'selector(:has())'], ['selector(:is(a))', '', 'selector(:is())'],
    ['selector(:where(a))', '', 'selector(:where())'], ['selector(::backdrop)', '', 'selector(::backdrop)'],
    ['all', 'unset'], ['appearance', 'none'], ['-webkit-appearance', 'none'],
    ['-webkit-overflow-scrolling', 'touch'], ['-webkit-text-size-adjust', '100%']
  ];

  for (var i = 0; i < PAIRS.length; i++) {
    var p = PAIRS[i];
    // Cas selector(...) : valeur vide => on sonde via CSS.supports(conditionText).
    if (p[1] === '' && p[0].indexOf('selector(') === 0) {
      (function (cond, label) {
        R.register({
          id: 'css.' + F.idSafe(cond),
          name: label || cond,
          category: 'css',
          description: 'CSS.supports("' + cond + '")',
          requires: [],
          quiet: true,
          run: function () {
            var ok = false;
            try { ok = !!(global.CSS && CSS.supports && CSS.supports(cond)); } catch (e) { ok = false; }
            return { status: ok ? 'pass' : 'skip', detail: ok ? 'supporte' : 'non supporte', measurements: { condition: cond, supported: ok } };
          }
        });
      })(p[0], p[2]);
    } else {
      F.css('css', 'css', p[0], p[1], p[2]);
    }
  }

})(typeof window !== 'undefined' ? window : this);
