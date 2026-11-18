/*
 * PSWKT - Sondes : surface d'API du contexte Canvas 2D
 * Presence de chaque methode/propriete de CanvasRenderingContext2D.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('canvas2d', 'Canvas 2D (API)', 'Presence of 2D context methods and properties.');

  var MEMBERS = [
    // Etat
    'save', 'restore', 'reset', 'canvas', 'getContextAttributes',
    // Transformations
    'scale', 'rotate', 'translate', 'transform', 'setTransform', 'getTransform', 'resetTransform',
    // Styles de composition
    'globalAlpha', 'globalCompositeOperation', 'filter',
    // Couleurs et styles
    'strokeStyle', 'fillStyle', 'createLinearGradient', 'createRadialGradient', 'createConicGradient',
    'createPattern',
    // Ombres
    'shadowOffsetX', 'shadowOffsetY', 'shadowBlur', 'shadowColor',
    // Rectangles
    'clearRect', 'fillRect', 'strokeRect',
    // Chemins
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo',
    'ellipse', 'rect', 'roundRect', 'fill', 'stroke', 'clip', 'isPointInPath', 'isPointInStroke',
    // Styles de trait
    'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'setLineDash', 'getLineDash', 'lineDashOffset',
    // Texte
    'font', 'textAlign', 'textBaseline', 'direction', 'fillText', 'strokeText', 'measureText',
    'fontKerning', 'letterSpacing', 'wordSpacing',
    // Images
    'drawImage', 'createImageData', 'getImageData', 'putImageData',
    // Lissage
    'imageSmoothingEnabled', 'imageSmoothingQuality',
    // Focus / accessibilite
    'drawFocusIfNeeded', 'scrollPathIntoView',
    // Divers
    'getImageDataSettings', 'isContextLost'
  ];

  for (var i = 0; i < MEMBERS.length; i++) {
    F.canvas2dMember('canvas2d', 'c2d', MEMBERS[i]);
  }

})(typeof window !== 'undefined' ? window : this);
