/*
 * PSWKT - Sondes : entrees, manette (Gamepad), pointeur, clavier
 * Particulierement pertinent pour la PS5 (manette DualSense via le navigateur).
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('input', 'Entrees & manette', 'Gamepad, pointeur, clavier, plein ecran, vibration.');

  var PATHS = [
    'Gamepad', 'GamepadButton', 'GamepadEvent', 'GamepadHapticActuator',
    'navigator.getGamepads', 'navigator.vibrate',
    'PointerEvent', 'navigator.maxTouchPoints', 'TouchEvent', 'Touch', 'TouchList',
    'KeyboardEvent', 'navigator.keyboard', 'InputEvent', 'WheelEvent', 'MouseEvent',
    'Element.prototype.requestPointerLock', 'Element.prototype.requestFullscreen',
    'Element.prototype.webkitRequestFullscreen', 'document.exitFullscreen',
    'document.pointerLockElement', 'navigator.userActivation', 'VirtualKeyboard',
    'Element.prototype.setPointerCapture', 'PointerEvent.prototype.getCoalescedEvents',
    'navigator.getVRDisplays', 'navigator.xr', 'DeviceOrientationEvent', 'DeviceMotionEvent'
  ];
  for (var i = 0; i < PATHS.length; i++) F.presence('input', 'inp', PATHS[i], PATHS[i]);

  // Lecture en direct des manettes connectees (comportemental, non destructif).
  R.register({
    id: 'input.gamepads.live',
    name: 'Manettes connectees (getGamepads)',
    category: 'input',
    description: 'Enumere les manettes actuellement vues par le navigateur.',
    requires: [],
    run: function (ctx) {
      if (!(global.navigator && typeof global.navigator.getGamepads === 'function')) {
        return { status: 'skip', detail: 'navigator.getGamepads absent', measurements: null };
      }
      var pads = [];
      try {
        var list = global.navigator.getGamepads();
        for (var i = 0; i < list.length; i++) {
          var p = list[i];
          if (p) pads.push({ index: p.index, id: p.id, buttons: p.buttons.length, axes: p.axes.length, mapping: p.mapping });
        }
      } catch (e) {
        return { status: 'skip', detail: 'lecture impossible : ' + e.message, measurements: null };
      }
      ctx.info('manettes detectees : ' + pads.length);
      for (var k = 0; k < pads.length; k++) ctx.info('manette ' + pads[k].index + ' : ' + pads[k].id + ' (' + pads[k].buttons + ' boutons, ' + pads[k].axes + ' axes)');
      return {
        status: 'pass',
        detail: pads.length ? (pads.length + ' manette(s) : ' + pads.map(function (x) { return x.id; }).join(' | ')) : 'aucune manette active (appuyez sur un bouton pour l activer)',
        measurements: { count: pads.length, pads: pads }
      };
    }
  });

})(typeof window !== 'undefined' ? window : this);
