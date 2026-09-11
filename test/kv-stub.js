// Shared KV double for the Worker suites (zero dependencies, like everything here).
//
// It lives in its own file rather than being exported from a *.test.js because
// importing one test file from another merges their hooks: subscribe.test.js's
// `beforeEach` and unsubscribe.test.js's would both run for every test in both,
// and the second one to install a fetch stub would win.

/** Minimal KV double: the surface the Worker actually uses. */
export function kvStub({ failing = false } = {}) {
  const store = new Map();
  return {
    store,
    async put(key, value) {
      if (failing) throw new Error("kv unavailable");
      store.set(key, value);
    },
    async get(key) {
      if (failing) throw new Error("kv unavailable");
      return store.has(key) ? store.get(key) : null;
    },
    async delete(key) {
      if (failing) throw new Error("kv unavailable");
      store.delete(key);
    },
  };
}
