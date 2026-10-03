(function () {
  var overlay;
  var timeout;
  var updating = false;
  var reloading = false;
  var watched = new WeakSet();

  function hide() {
    updating = false;
    clearTimeout(timeout);
    if (overlay) overlay.remove();
    overlay = null;
  }

  function show() {
    if (updating) return;
    updating = true;
    function render() {
      if (!updating || overlay) return;
      overlay = document.createElement('div');
      overlay.id = 'pwa-update';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = '<div class="pwa-update-card"><div class="pwa-update-ring" aria-hidden="true"></div><h1>Installing update…</h1><p>Please wait while we prepare the latest version.</p><button type="button" hidden>Continue using app</button></div>';
      overlay.querySelector('button').addEventListener('click', hide);
      document.body.appendChild(overlay);
      timeout = setTimeout(function () {
        if (!overlay) return;
        overlay.querySelector('p').textContent = 'This is taking longer than usual. Check your connection, or continue using the app while the update finishes.';
        overlay.querySelector('button').hidden = false;
      }, 30000);
    }
    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  window.addEventListener('ahadiya:update-start', show);
  window.addEventListener('ahadiya:update-end', hide);

  function watch(registration) {
    if (watched.has(registration)) return;
    watched.add(registration);
    function track() {
      var worker = registration.installing || registration.waiting;
      // The first offline installation is not an app update.
      if (!worker || !navigator.serviceWorker.controller) return;
      show();
      worker.addEventListener('statechange', function () {
        if (worker.state === 'redundant') hide();
      });
    }
    registration.addEventListener('updatefound', track);
    track();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(watch);
    }).catch(function () {});
    navigator.serviceWorker.ready.then(watch).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!updating || reloading) return;
      reloading = true;
      // Let the browser paint the status before switching to the new version.
      setTimeout(function () { window.location.reload(); }, 150);
    });
  }
})();
