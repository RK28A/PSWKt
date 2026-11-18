/*
 * PSWKT - Sondes massives : CSS supplementaires (CSS.supports)
 * Complete la categorie CSS avec davantage de proprietes/valeurs modernes.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.factory;

  var PAIRS = [
    // Selecteurs / fonctions modernes (via selector())
    ['selector(:has(a))', ''], ['selector(:is(a))', ''], ['selector(:where(a))', ''],
    ['selector(::backdrop)', ''], ['selector(:focus-visible)', ''], ['selector(:modal)', ''],
    // Couleur
    ['color', 'oklch(0.7 0.1 200)'], ['color', 'oklab(0.5 0.1 0.1)'], ['color', 'lab(50% 40 59)'],
    ['color', 'lch(52% 72 59)'], ['color', 'color(display-p3 1 0 0)'], ['color', 'rgb(0 0 0 / 50%)'],
    ['color', 'hsl(0 100% 50% / 0.5)'], ['color', 'hwb(0 0% 0%)'], ['color', 'color-mix(in oklch, red, blue)'],
    ['color', 'light-dark(white, black)'], ['accent-color', 'red'], ['caret-color', 'red'],
    // Typographie
    ['font-variation-settings', '"wght" 400'], ['font-optical-sizing', 'auto'],
    ['font-synthesis', 'none'], ['text-wrap', 'balance'], ['text-wrap', 'pretty'],
    ['hyphens', 'auto'], ['line-break', 'anywhere'], ['text-decoration-thickness', '2px'],
    ['text-underline-offset', '2px'], ['-webkit-text-stroke', '1px black'], ['text-emphasis', 'dot'],
    ['font-feature-settings', '"liga"'], ['tab-size', '4'], ['text-align-last', 'center'],
    // Mise en page avancee
    ['aspect-ratio', '1'], ['gap', '1ch'], ['grid-template', 'none'], ['grid-auto-flow', 'dense'],
    ['align-content', 'space-evenly'], ['justify-items', 'stretch'], ['place-self', 'center'],
    ['margin-trim', 'block'], ['inset-block', '0'], ['inset-inline', '0'], ['margin-block', '0'],
    ['padding-inline', '0'], ['border-block', '1px solid'], ['inline-size', '10px'],
    ['block-size', '10px'], ['min-inline-size', '0'], ['max-block-size', 'none'],
    // Fonctions mathematiques
    ['width', 'calc(10px + 1em)'], ['width', 'min(10px, 2em)'], ['width', 'max(10px, 2em)'],
    ['width', 'clamp(1px, 2vw, 10px)'], ['width', 'round(10.5px, 1px)'], ['width', 'mod(10px, 3px)'],
    ['width', 'rem(10px, 3px)'], ['aspect-ratio', 'calc(16/9)'], ['width', 'abs(-10px)'],
    ['width', 'calc(sin(30deg) * 10px)'], ['width', 'calc(pi * 1px)'],
    // Unites
    ['width', '10dvh'], ['width', '10svh'], ['width', '10lvh'], ['width', '10cqw'], ['width', '10cqi'],
    ['width', '10vmax'], ['height', '10dvb'], ['font-size', '1cap'], ['font-size', '1ic'], ['font-size', '1rlh'],
    // Transforms / effets
    ['transform', 'translate3d(0,0,0)'], ['transform', 'rotate3d(1,1,1,45deg)'], ['perspective', '100px'],
    ['backdrop-filter', 'blur(5px)'], ['-webkit-backdrop-filter', 'blur(5px)'], ['filter', 'blur(5px)'],
    ['mix-blend-mode', 'multiply'], ['clip-path', 'circle(50%)'], ['mask', 'url(#m)'], ['-webkit-mask', 'none'],
    ['offset-path', 'path("M0 0")'], ['scale', '1.5'], ['rotate', '45deg'], ['translate', '10px'],
    // Animations / scroll
    ['scroll-behavior', 'smooth'], ['scroll-snap-type', 'x mandatory'], ['scroll-snap-align', 'center'],
    ['scroll-timeline', 'none'], ['animation-timeline', 'auto'], ['view-timeline', 'none'],
    ['overscroll-behavior', 'none'], ['scrollbar-width', 'thin'], ['scrollbar-gutter', 'stable'],
    ['will-change', 'transform'], ['touch-action', 'manipulation'],
    // Interactivite / divers
    ['appearance', 'none'], ['-webkit-appearance', 'none'], ['user-select', 'none'],
    ['-webkit-user-select', 'none'], ['pointer-events', 'none'], ['all', 'unset'],
    ['color-scheme', 'dark'], ['forced-color-adjust', 'none'], ['image-rendering', 'pixelated'],
    ['content-visibility', 'auto'], ['contain-intrinsic-size', '100px'], ['field-sizing', 'content'],
    ['anchor-name', '--a'], ['position-anchor', '--a'], ['text-box-trim', 'both'],
    // Variables / cascade
    ['--x', '1'], ['width', 'var(--x, 10px)']
  ];

  for (var i = 0; i < PAIRS.length; i++) {
    F.css('css', 'cssx' + i, PAIRS[i][0], PAIRS[i][1], PAIRS[i][0] + (PAIRS[i][1] ? (': ' + PAIRS[i][1]) : ''));
  }

})(typeof window !== 'undefined' ? window : this);
