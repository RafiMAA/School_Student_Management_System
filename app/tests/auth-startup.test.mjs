import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/contexts/AuthContext.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const profile = { id: 'user-1', email: 'teacher@example.com', role: 'Teacher' };
const session = { user: profile, access_token: 'test-token' };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

// Run the actual provider against an auth mock that awaits its subscribers
// before allowing session-dependent profile requests to finish.
function mount({ event = 'SIGNED_IN', savedSession = session, installed = false, loadProfile } = {}) {
  const effects = [], states = [];
  let listener, profileCalls = 0;
  let lock = Promise.resolve();
  const storage = new Map();
  const browserStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  const auth = {
    getSession: async () => {
      await Promise.resolve();
      lock = Promise.resolve(listener(event, savedSession));
      await lock;
      return { data: { session: savedSession } };
    },
    onAuthStateChange: callback => {
      listener = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signOut: async () => { await listener('SIGNED_OUT', null); },
  };
  const modules = {
    react: {
      createContext: () => ({ Provider: 'provider' }),
      useState: initial => {
        const index = states.push(initial) - 1;
        return [initial, value => { states[index] = value; }];
      },
      useEffect: callback => effects.push(callback),
      useRef: current => ({ current }), useCallback: callback => callback,
    },
    'react/jsx-runtime': { jsx: () => null }, 'react-router-dom': {},
    '@/lib/supabase': { supabase: { auth } },
    '@/lib/auth.service': {
      restoreUser: async () => savedSession ? profile : null,
      loadAdminProfile: async () => {
        profileCalls++;
        await Promise.resolve();
        await lock;
        return loadProfile ? loadProfile() : profile;
      },
    },
    '@/lib/apiClient': { setAccessToken() {}, SESSION_EXPIRED_EVENT: 'expired' },
    '@/lib/pwaInstall': { isRunningAsPWA: () => installed },
    '@/components/StartupScreen': {},
  };
  const context = {
    exports: {}, require: name => { assert.ok(name in modules); return modules[name]; },
    localStorage: browserStorage, sessionStorage: browserStorage,
    window: { addEventListener() {}, removeEventListener() {} }, setTimeout, clearTimeout,
  };
  vm.runInNewContext(compiled, context);
  context.exports.AuthProvider({ children: null });
  const cleanups = effects.map(effect => effect());
  return { states, emit: (event, session) => listener(event, session),
    profileCalls: () => profileCalls,
    unmount: () => cleanups.forEach(cleanup => cleanup?.()) };
}

for (const installed of [false, true]) {
  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED']) {
    test(`${installed ? 'PWA' : 'browser'} startup completes after ${event}`, async () => {
      const app = mount({ installed, event });
      await tick();
      assert.equal(app.states[1], false, 'startup must finish without reloading');
      assert.equal(app.states[0], profile);
      assert.equal(app.profileCalls(), 1);
      app.unmount();
    });
  }
}

test('signed-out startup reaches the login state', async () => {
  const app = mount({ event: 'INITIAL_SESSION', savedSession: null });
  await tick();
  assert.equal(app.states[1], false);
  assert.equal(app.states[0], null);
  app.unmount();
});

test('an in-flight profile cannot restore a user after sign-out', async () => {
  let resolveProfile;
  const pending = new Promise(resolve => { resolveProfile = resolve; });
  const app = mount({ loadProfile: () => pending });
  await tick();
  assert.equal(app.emit('SIGNED_OUT', null), undefined);
  resolveProfile(profile);
  await tick();
  assert.equal(app.states[0], null);
  app.unmount();
});

test('unmount cancels pending profile work', async () => {
  const app = mount({ event: 'INITIAL_SESSION' });
  await tick();
  app.emit('SIGNED_IN', session);
  app.unmount();
  await tick();
  assert.equal(app.profileCalls(), 0);
});
