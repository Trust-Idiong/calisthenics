/* Installation, offline readiness, and consent-based service-worker updates. */
export function workoutIsActive(status) {
  return status === 'running' || status === 'paused';
}

export function reloadIsSafe(status, unsavedChanges) {
  return !workoutIsActive(status) && unsavedChanges !== 'true';
}

export function isIOS(nav) {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

export function isStandalone(win, nav) {
  return win.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

if (typeof document !== 'undefined') initializePWA();

function initializePWA() {
  const mount = document.getElementById('pwa-controls');
  if (!mount) return;
  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  let registration = null, waitingWorker = null, installPrompt = null;
  let offlineReady = false, updateConsent = false, updateActivated = false;
  let dismissedUpdate = null, previouslyFocused = null;
  let hadController = !!navigator.serviceWorker?.controller;
  let installed = isStandalone(window, navigator);
  const status = document.createElement('span');
  status.className = 'pwa-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const install = button('Install app', 'pwa-action');
  const update = button('Update available', 'pwa-action pwa-update');
  update.hidden = true;
  const settings = button('ⓘ', 'pwa-action pwa-settings');
  settings.setAttribute('aria-label', 'Offline app and storage settings');
  settings.title = 'Offline app and storage settings';
  mount.append(status, update, install, settings);
  const dialog = document.createElement('dialog');
  dialog.className = 'pwa-dialog';
  dialog.setAttribute('aria-labelledby', 'pwa-dialog-title');
  dialog.setAttribute('aria-describedby', 'pwa-dialog-copy');
  document.body.append(dialog);

  function button(label, className) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    return element;
  }

  function activeWorkout() {
    const explicit = document.documentElement.dataset.workoutStatus;
    if (explicit) return workoutIsActive(explicit);
    // Compatibility with the original FORM SEVEN package.
    return ['Pause', 'Resume'].includes(document.getElementById('start-label')?.textContent?.trim());
  }

  function hasUnsavedChanges() {
    return document.documentElement.dataset.unsavedChanges === 'true';
  }

  function reloadBlocked() {
    return activeWorkout() || hasUnsavedChanges();
  }

  function refreshStatus() {
    const online = navigator.onLine;
    status.dataset.offline = String(!online);
    const text = !online
      ? offlineReady ? 'Offline · workouts ready' : 'Offline · connect to save the app'
      : offlineReady ? 'Ready offline' : 'Preparing offline copy…';
    if (status.textContent !== text) status.textContent = text;
    status.title = offlineReady
      ? 'Workouts and your saved journal are available offline. Online video demonstrations need an internet connection.'
      : 'Keep this page open until the offline copy is ready.';
    install.hidden = installed || isStandalone(window, navigator);
    update.hidden = !waitingWorker && !updateActivated;
    update.textContent = updateActivated ? 'Reload to finish update' : 'Update available';
  }

  function closeDialog() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => { previouslyFocused?.focus(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });

  function showDialog(title, copy, content) {
    previouslyFocused = document.activeElement;
    dialog.replaceChildren();
    const head = document.createElement('div');
    head.className = 'pwa-dialog-head';
    const heading = document.createElement('h2');
    heading.id = 'pwa-dialog-title';
    heading.textContent = title;
    const close = button('×', 'pwa-dialog-close');
    close.setAttribute('aria-label', 'Close app settings');
    close.addEventListener('click', closeDialog);
    head.append(heading, close);
    const description = document.createElement('p');
    description.id = 'pwa-dialog-copy';
    description.textContent = copy;
    dialog.append(head, description);
    content?.(dialog);
    if (!dialog.open) dialog.showModal();
    close.focus();
  }

  function addBackupAndStorage(parent) {
    const explanation = document.createElement('p');
    explanation.textContent = 'Your progress stays in this browser or installed app on this device. Keep a backup before switching browsers, devices, or clearing site data.';
    parent.append(explanation);
    const actions = document.createElement('div');
    actions.className = 'pwa-dialog-actions';
    const backup = button('Download my backup', '');
    backup.addEventListener('click', () => document.getElementById('export-data')?.click());
    if (!document.getElementById('export-data')) backup.hidden = true;
    const protect = button('Keep my data on this device', '');
    protect.hidden = !navigator.storage?.persist;
    const note = document.createElement('p');
    note.className = 'pwa-storage-note';
    note.setAttribute('role', 'status');
    protect.addEventListener('click', async () => {
      protect.disabled = true;
      try {
        const persisted = await navigator.storage.persist();
        note.textContent = persisted
          ? 'Storage protection is enabled. You can still remove the data in browser settings; keep a backup too.'
          : 'Your browser did not grant storage protection. Your entries still save normally; download regular backups.';
      } catch {
        note.textContent = 'Storage protection is unavailable in this browser. Download a backup to keep a separate copy.';
      } finally { protect.disabled = false; }
    });
    actions.append(backup, protect);
    parent.append(actions, note);
  }

  async function promptInstall() {
    if (installPrompt) {
      const pending = installPrompt;
      installPrompt = null;
      await pending.prompt();
      await pending.userChoice;
      refreshStatus();
      return;
    }
    showDialog('Keep FORM SEVEN close', 'Install this app for a focused, full-screen training space. Workouts and your journal work offline once the offline copy is ready.', parent => {
      const steps = document.createElement('ol');
      const instructions = isIOS(navigator)
        ? ['Open this page in Safari.', 'Tap the Share button (the square with an upward arrow).', 'Choose Add to Home Screen, enable Open as Web App if shown, then tap Add.']
        : ['Open your browser menu, or use the install icon in the address bar.', 'Choose Install app or Add to Home screen, then confirm the installation.'];
      for (const text of instructions) { const item = document.createElement('li'); item.textContent = text; steps.append(item); }
      parent.append(steps);
      const note = document.createElement('p');
      note.className = 'pwa-device-note';
      note.textContent = 'If installation is unavailable in this browser, the app still works here. Video demonstrations need an internet connection.';
      parent.append(note);
      addBackupAndStorage(parent);
    });
  }
  install.addEventListener('click', () => { promptInstall().catch(() => showSettings()); });

  function showSettings() {
    showDialog('Your offline training space', offlineReady
      ? 'The app is saved for offline use. Guided intervals, movement instructions, and your progress journal are available without a connection. Videos need internet access.'
      : 'The offline copy is still being prepared. Keep this page open with an internet connection until the status says Ready offline.', addBackupAndStorage);
  }
  settings.addEventListener('click', showSettings);

  function showUpdate() {
    const active = activeWorkout();
    const unsaved = hasUnsavedChanges();
    showDialog('A fresh version is ready', unsaved
      ? 'Some progress could not be saved in this browser. Download a backup before reloading. Apply the update after your changes save successfully.'
      : active
      ? 'Finish or reset your current workout before applying this update. Your saved progress will be kept.'
      : 'Apply the update and reload this page. Your saved journal and plan will be kept.', parent => {
      if (unsaved) addBackupAndStorage(parent);
      const actions = document.createElement('div');
      actions.className = 'pwa-dialog-actions';
      const apply = button('Update now', 'pwa-primary');
      apply.disabled = active || unsaved;
      const later = button('Later', '');
      later.addEventListener('click', () => { dismissedUpdate = waitingWorker; closeDialog(); });
      apply.addEventListener('click', () => {
        // Re-check on consent in case the workout began while the dialog was open.
        if (reloadBlocked()) { showUpdate(); return; }
        updateConsent = true;
        closeDialog();
        if (updateActivated) reloadWhenSafe();
        else waitingWorker?.postMessage({type: 'ACTIVATE_UPDATE'});
      });
      actions.append(apply, later);
      parent.append(actions);
    });
  }
  update.addEventListener('click', showUpdate);

  function reloadWhenSafe() {
    if (!updateConsent || reloadBlocked()) return;
    window.location.reload();
  }
  function noticeWaiting() {
    if (!registration?.waiting) return;
    waitingWorker = registration.waiting;
    refreshStatus();
    // Prompt only between workouts, with the action also available in the toolbar.
    if (!reloadBlocked() && dismissedUpdate !== waitingWorker && !document.querySelector('dialog[open]')) showUpdate();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    refreshStatus();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; installed = true; refreshStatus(); });
  standaloneMedia.addEventListener?.('change', refreshStatus);
  window.addEventListener('online', () => { refreshStatus(); registration?.update().catch(() => {}); });
  window.addEventListener('offline', refreshStatus);
  const observer = new MutationObserver(() => {
    if (dialog.open && dialog.querySelector('.pwa-primary')) {
      dialog.querySelector('.pwa-primary').disabled = reloadBlocked();
    }
    // If a different open tab activated the update, this tab keeps training
    // until the person accepts a reload between workouts.
    if (updateActivated && updateConsent) reloadWhenSafe();
  });
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-workout-status', 'data-unsaved-changes']});
  const startLabel = document.getElementById('start-label');
  if (startLabel) observer.observe(startLabel, {childList: true, characterData: true, subtree: true});

  refreshStatus();
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = 'Offline install unavailable';
    status.title = 'Open the hosted HTTPS app to enable offline use and installation.';
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    offlineReady = true;
    const replacingExistingWorker = hadController;
    hadController = true;
    if (replacingExistingWorker || waitingWorker || updateConsent) {
      waitingWorker = null;
      updateActivated = true;
      refreshStatus();
      reloadWhenSafe();
    } else refreshStatus();
  });
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {scope: './', updateViaCache: 'none'})
    .then(async reg => {
      registration = reg;
      offlineReady = !!reg.active;
      refreshStatus();
      noticeWaiting();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) noticeWaiting();
          if (worker.state === 'activated') { offlineReady = true; refreshStatus(); }
        });
      });
      await navigator.serviceWorker.ready;
      offlineReady = true;
      refreshStatus();
      // Check when returning to the app. No reload or activation happens here.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.onLine) reg.update().catch(() => {});
      });
    })
    .catch(() => {
      status.textContent = 'Offline copy unavailable';
      status.title = 'The browser could not save the offline copy. Reconnect and reopen the app; progress still saves in this browser.';
    });
}
