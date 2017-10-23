import runtime from 'offline-plugin/runtime';

import _$ from 'utils';

_$.app.sw.isSetup = true;

runtime.install({
  onInstalled() {
    _$.app.sw.isInstalled = true;
    _$.events.trigger("swInstalled");
  },

  onUpdating() {
    _$.app.sw.isUpdating = true;
    _$.events.trigger("swUpdating");
  },

  // When an update is ready, tell ServiceWorker to take control immediately:
  onUpdateReady() {
    console.log('Service worker: update ready');
    _$.app.sw.isReady = true;
    _$.events.trigger("swReady");
    runtime.applyUpdate();
  },

  onUpdateFailed() {
    _$.app.sw.hasFailed = true;
    _$.events.trigger("swFailed");
  },

  // Reload to get the new version:
  onUpdated() {
    console.log('Service worker: updated');
    _$.app.sw.isUpdated = true;
    _$.events.trigger("swUpdated");
    location.reload();
  }
});
