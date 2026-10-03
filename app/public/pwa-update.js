(function () {
  var overlay;
  var timeout;
  var updating = false;
  var reloading = false;
  var pendingUpdate = false;
  var watchedWorkers = new WeakSet();
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
      overlay.innerHTML = '<div class="pwa-update-card"><div class="pwa-update-ring" aria-hidden="true"></div><h1>Installing update…</h1><p>Please wait while we prepare the latest version.</p><button type="button">Continue using app</button></div>';
      overlay.querySelector('button').addEventListener('click', hide);
      document.body.appendChild(overlay);
      // A slow/offline update must never leave a full-screen blocker behind.
      timeout = setTimeout(hide, 15000);
    }
    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  window.addEventListener('ahadiya:update-start', show);
  window.addEventListener('ahadiya:update-end', hide);

  function reload() {
    if (reloading) return;
    reloading = true;
    hide();
    window.location.reload();
  }

  function watch(registration) {
    if (!registration || watched.has(registration)) return;
    watched.add(registration);
    function track() {
      var worker = registration.installing || registration.waiting;
      // The first offline installation is not an app update.
      if (!worker || !navigator.serviceWorker.controller || watchedWorkers.has(worker)) return;
      watchedWorkers.add(worker);
      pendingUpdate = true;
      show();
      function checkState() {
        if (worker.state === 'installed') {
          worker.postMessage({ type: 'SKIP_WAITING' });
        } else if (worker.state === 'activated') {
          worker.removeEventListener('statechange', checkState);
          reload();
        } else if (worker.state === 'redundant') {
          worker.removeEventListener('statechange', checkState);
          pendingUpdate = false;
          hide();
        }
      }
      worker.addEventListener('statechange', checkState);
      checkState();
    }
    registration.addEventListener('updatefound', track);
    track();
  }

  if ('serviceWorker' in navigator) {
    // Only watch the registration that serves this page.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (pendingUpdate || updating) reload();
    });
    navigator.serviceWorker.getRegistration().then(watch).catch(function () {});
    navigator.serviceWorker.ready.then(watch).catch(function () {});
  }
})();
