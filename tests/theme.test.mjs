import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync(new URL('../public/theme.js', import.meta.url), 'utf8');
const key = 'f1stories-theme';
function boot({ saved, session, legacy, light = false, failRead = false, failWrite = false, failSession = false, noMedia = false } = {}) {
  const local = new Map(saved === undefined ? [] : [[key, saved]]);
  const temporary = new Map(session === undefined ? [] : [[key, session]]);
  if (legacy) local.set('aerotunnel-theme', legacy);
  const writes = [];
  const storage = (map, isSession = false) => ({
    getItem(name) { if (isSession ? failSession : failRead) throw Error('blocked'); return map.get(name) ?? null; },
    setItem(name, value) { if (isSession ? failSession : failWrite) throw Error('blocked'); map.set(name, value); writes.push([isSession, name, value]); },
    removeItem(name) { if (isSession ? failSession : failWrite) throw Error('blocked'); map.delete(name); },
  });
  let systemListener, storageListener;
  const media = { matches: light, addEventListener(type, listener) { assert.equal(type, 'change'); systemListener = listener; } };
  const root = { dataset: {}, style: {} };
  let meta;
  const window = { addEventListener(type, listener) { assert.equal(type, 'storage'); storageListener = listener; } };
  if (!noMedia) window.matchMedia = () => media;
  vm.runInNewContext(source, { window, document: { documentElement: root, querySelector: () => ({ setAttribute: (name, value) => { meta = value; } }) }, localStorage: storage(local), sessionStorage: storage(temporary, true) });
  return { root, controller: window.aeroTunnelTheme, local, temporary, writes, meta: () => meta,
    system(value) { media.matches = value; systemListener?.(); },
    external(value) { if (value === null) local.delete(key); else local.set(key, value); storageListener({ key }); },
  };
}

test('fresh startup follows OS, does not write, and applies first-paint attributes', () => {
  for (const light of [false, true]) {
    const app = boot({ light });
    assert.equal(app.controller.getSnapshot(), light ? 'light' : 'dark');
    assert.equal(app.root.dataset.theme, app.controller.getSnapshot());
    assert.equal(app.root.style.colorScheme, app.controller.getSnapshot());
    assert.equal(app.meta(), light ? '#f2eee4' : '#1b1a19');
    assert.equal(app.writes.length, 0);
    app.system(!light);
    assert.equal(app.controller.getSnapshot(), light ? 'dark' : 'light');
  }
});

test('explicit canonical choices beat OS and obsolete forced-dark key', () => {
  for (const saved of ['light', 'dark']) {
    const app = boot({ saved, light: saved === 'dark', legacy: 'dark' });
    app.system(saved !== 'light');
    assert.equal(app.controller.getSnapshot(), saved);
    assert.equal(app.local.get('aerotunnel-theme'), 'dark');
    assert.equal(app.writes.length, 0);
  }
  const old = boot({ legacy: 'dark', light: true });
  assert.equal(old.controller.getSnapshot(), 'light');
  assert.equal(old.local.has(key), false);
});

test('invalid, empty and sibling auto values remain untouched and follow OS', () => {
  for (const saved of ['', 'auto', 'LIGHT', 'invalid']) {
    const app = boot({ saved, light: true });
    assert.equal(app.controller.getSnapshot(), 'light');
    app.system(false);
    assert.equal(app.controller.getSnapshot(), 'dark');
    assert.equal(app.local.get(key), saved);
    assert.equal(app.writes.length, 0);
  }
});

test('canonical session fallback migrates an existing explicit choice', () => {
  const app = boot({ session: 'light' });
  assert.equal(app.controller.getSnapshot(), 'light');
  assert.equal(app.local.get(key), 'light');
  assert.equal(app.temporary.has(key), false);
});

test('toggle persists only explicit choices; subscribers unsubscribe cleanly', () => {
  const app = boot(); let updates = 0;
  const unsubscribe = app.controller.subscribe(() => updates++);
  app.controller.toggle();
  assert.equal(app.local.get(key), 'light');
  app.system(false);
  assert.equal(app.controller.getSnapshot(), 'light');
  assert.equal(updates, 1);
  unsubscribe();app.controller.toggle();assert.equal(updates, 1);
  assert.equal(boot({ saved: app.local.get(key) }).controller.getSnapshot(), 'dark');
});

test('blocked reads/writes never prevent switching and preserve current-tab intent', () => {
  for (const options of [{ failRead: true }, { failWrite: true }, { failRead: true, failWrite: true, failSession: true }]) {
    const app = boot(options);app.controller.toggle();app.system(false);
    assert.equal(app.controller.getSnapshot(), 'light');
  }
  const sessionOnly = boot({ failRead: true, failWrite: true });
  sessionOnly.controller.toggle();
  assert.equal(sessionOnly.temporary.get(key), 'light');
  assert.equal(boot({ session: 'light', failRead: true, failWrite: true }).controller.getSnapshot(), 'light');
});

test('same-origin preference changes and removal update without writing defaults', () => {
  const app = boot();app.external('light');assert.equal(app.controller.getSnapshot(), 'light');
  app.external(null);assert.equal(app.controller.getSnapshot(), 'dark');
  app.system(true);assert.equal(app.controller.getSnapshot(), 'light');
  assert.equal(app.writes.length, 0);
});

test('unavailable OS preference defaults to dark without persisting it', () => {
  const app = boot({ noMedia: true });assert.equal(app.controller.getSnapshot(), 'dark');assert.equal(app.writes.length, 0);
});
