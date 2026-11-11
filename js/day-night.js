/* Visual-only day/night prototype. No save schema or gameplay mutations. */
(function () {
  'use strict';
  var world = document.getElementById('screen-world');
  var canvas = document.getElementById('world-canvas');
  var hud = document.getElementById('hud');
  if (!world || !canvas || !hud) return;
  var tint = document.createElement('div');
  tint.id = 'day-night-tint';
  tint.setAttribute('aria-hidden', 'true');
  tint.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;background:#10264e;opacity:0;transition:opacity 1s linear';
  canvas.insertAdjacentElement('afterend', tint);
  hud.style.zIndex = '2';
  var clock = document.createElement('span');
  clock.id = 'world-clock';
  clock.setAttribute('aria-label', 'In-game time');
  clock.style.cssText = 'font-size:12px;color:#f4d38a;font-weight:600';
  var label = document.getElementById('hud-zone');
  if (label) label.insertAdjacentElement('afterend', clock);
  var daySeconds = 30 * 60, elapsed = daySeconds * 0.375;
  var previous = null;
  function draw() {
    var hour = (elapsed / daySeconds * 24) % 24;
    var darkness;
    if (hour >= 19 || hour < 5) darkness = 0.58;
    else if (hour < 7) darkness = 0.58 * (7 - hour) / 2;
    else if (hour < 17) darkness = 0;
    else darkness = 0.58 * (hour - 17) / 2;
    tint.style.opacity = darkness.toFixed(3);
    var h = Math.floor(hour), m = Math.floor((hour - h) * 60);
    clock.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m +
      (hour >= 19 || hour < 5 ? ' Night' : hour < 7 ? ' Dawn' : hour >= 17 ? ' Dusk' : ' Day');
  }
  function frame(now) {
    if (previous !== null && world.classList.contains('active') && !document.hidden &&
        !document.getElementById('save-lock')?.classList.contains('show') &&
        document.getElementById('game-menu')?.hidden) {
      elapsed = (elapsed + Math.min((now - previous) / 1000, 0.1)) % daySeconds;
    }
    previous = now;
    draw();
    requestAnimationFrame(frame);
  }
  draw();
  requestAnimationFrame(frame);
})();
