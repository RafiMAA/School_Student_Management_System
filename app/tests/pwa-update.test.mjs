import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/pwa-update.js', import.meta.url), 'utf8');
async function mount({ state = 'installing', controlled = true } = {}) {
  const worker = Object.assign(new EventTarget(), {
    state, messages: [], postMessage(message) { this.messages.push(message.type); },
  });
  const registration = Object.assign(new EventTarget(), { installing: worker });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
    getRegistration: async () => registration, ready: Promise.resolve(registration),
  });
  const timers = new Map();
  let visible = false, reloads = 0, button;
  const window = Object.assign(new EventTarget(), { location: { reload() { reloads++; } } });
  const document = {
    body: { appendChild() { visible = true; } },
    createElement() {
      button = new EventTarget();
      return { setAttribute() {}, querySelector: () => button, remove() { visible = false; } };
    },
  };
  vm.runInNewContext(source, {
    window, document, navigator: { serviceWorker },
    setTimeout(callback) { const id = {}; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  await Promise.resolve();
  return {
    worker, serviceWorker, visible: () => visible, reloads: () => reloads,
    dismiss() { button.dispatchEvent(new Event('click')); },
    state(value) { worker.state = value; worker.dispatchEvent(new Event('statechange')); },
    expire() { for (const callback of [...timers.values()]) callback(); },
  };
}
test('first offline install does not block or reload', async () => {
  const app = await mount({ controlled: false });
  app.state('activated');
  app.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(app.visible(), false);
  assert.equal(app.reloads(), 0);
});
test('activation completes without controllerchange and reloads only once', async () => {
  const app = await mount();
  assert.equal(app.visible(), true);
  app.state('activated');
  assert.equal(app.visible(), false);
  assert.equal(app.reloads(), 1);
  app.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(app.reloads(), 1);
});
test('an already waiting update is asked to activate', async () => {
  const app = await mount({ state: 'installed' });
  assert.deepEqual(app.worker.messages, ['SKIP_WAITING']);
});
for (const action of ['dismiss', 'expire']) {
  test(`${action} releases the app while allowing the update to finish`, async () => {
    const app = await mount();
    app[action]();
    assert.equal(app.visible(), false);
    assert.equal(app.reloads(), 0);
    app.serviceWorker.dispatchEvent(new Event('controllerchange'));
    assert.equal(app.reloads(), 1);
  });
}
test('failed installation releases the app', async () => {
  const app = await mount();
  app.state('redundant');
  assert.equal(app.visible(), false);
  assert.equal(app.reloads(), 0);
});
test('push worker does not hold activation open for optional network work', () => {
  const handlers = new Map();
  vm.runInNewContext(readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8'), {
    self: { addEventListener(type, handler) { handlers.set(type, handler); } },
    fetch() { assert.fail('startup must not request metadata'); },
  });
  const pending = [];
  handlers.get('activate')?.({ waitUntil(promise) { pending.push(promise); } });
  assert.equal(pending.length, 0);
  assert.ok(handlers.has('push'));
  assert.ok(handlers.has('notificationclick'));
});
