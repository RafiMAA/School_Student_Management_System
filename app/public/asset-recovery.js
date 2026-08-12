(function () {
  var recoveryKey = 'ahadiya-asset-recovery-attempted';

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (!(target instanceof HTMLScriptElement) && !(target instanceof HTMLLinkElement)) return;
    var assetUrl = target.src || target.href || '';
    if (assetUrl.indexOf('/assets/') === -1 || sessionStorage.getItem(recoveryKey)) return;

    sessionStorage.setItem(recoveryKey, 'true');
    var clearCaches = 'caches' in window
      ? caches.keys().then(function (keys) { return Promise.all(keys.map(function (key) { return caches.delete(key); })); })
      : Promise.resolve();
    var updateWorkers = 'serviceWorker' in navigator
      ? navigator.serviceWorker.getRegistrations().then(function (registrations) {
          return Promise.all(registrations.map(function (registration) { return registration.update(); }));
        })
      : Promise.resolve();

    Promise.all([clearCaches, updateWorkers]).finally(function () {
      window.location.reload();
    });
  }, true);
})();
