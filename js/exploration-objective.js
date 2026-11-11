/* LEGEND OF ELDORIA — First playable world: exploration guidance.
   Presentation only: never writes to game state or Save Engine. */
(function () {
  'use strict';
  var screen = document.getElementById('screen-world');
  var hud = document.getElementById('hud');
  var zone = document.getElementById('hud-zone');
  if (!screen || !hud || !zone) return;
  var hint = document.createElement('div');
  hint.id = 'exploration-objective';
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  hint.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top, 0px) + 66px);right:10px;max-width:min(56vw,300px);padding:8px 10px;border:1px solid rgba(230,176,75,.45);border-radius:9px;background:rgba(10,25,27,.83);color:#f1e7c8;font:600 12px/1.35 sans-serif;pointer-events:none;z-index:2;text-align:right';
  screen.appendChild(hint);
  var last = '';
  function update() {
    if (screen.classList.contains('active')) {
      var name = zone.textContent || '';
      var message = /forest/i.test(name)
        ? 'Explore Whispering Forest · Return via the entrance'
        : 'Explore Greenvale · Find the eastern forest gate';
      if (message !== last) { hint.textContent = message; last = message; }
    }
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
})();