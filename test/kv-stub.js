// Shared KV double for the Worker suites (zero dependencies, like everything here).
//
// It lives in its own file rather than being exported from a *.test.js because
// importing one test file from another merges their hooks: subscribe.test.js's
// `beforeEach` and unsubscribe.test.js's would both run for every test in both,
// and the second one to install a fetch stub would win.

/** Minimal KV double: the surface the Worker actually uses. */
export function kvStub({ failing = false, pageSize = 10 } = {}) {
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

    /**
     * Real KV shape: `{ keys: [{ name }], list_complete, cursor }`, lexicographic.
     *
     * It PAGES on purpose, in small pages. A stub that answered everything in
     * one `list_complete: true` would leave the caller's cursor loop unexercised
     * — and an unexercised cursor loop is how a queue silently stops at the
     * first page once it outgrows one.
     */
    async list({ prefix = "", cursor, limit = pageSize } = {}) {
      if (failing) throw new Error("kv unavailable");
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? all.indexOf(cursor) + 1 : 0;
      const page = all.slice(start, start + limit);
      const last = page[page.length - 1];
      const complete = start + page.length >= all.length;
      return {
        keys: page.map((name) => ({ name })),
        list_complete: complete,
        cursor: complete ? undefined : last,
      };
    },
  };
}
