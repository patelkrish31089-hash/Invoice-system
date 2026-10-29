/** Storage that survives being embedded in a sandboxed iframe and that never loses a session it just wrote.
 *
 * Two situations break plain `localStorage`:
 * - Browsers give a document inside `<iframe sandbox="allow-scripts">` an *opaque* origin, and
 *   `localStorage` then throws `SecurityError` on access.
 * - Some browsers accept the storage probe but refuse a later write (quota, privacy modes, blocked
 *   third-party storage). The write fails silently, and a read then returns nothing.
 *
 * Every write is therefore also kept in an in-memory copy for this document. Reads prefer browser
 * storage (so a sign-out or sign-in in another tab still applies) and fall back to the in-memory
 * copy. The session survives inside a document, but not a page refresh in the sandboxed preview.
 */

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memory = new Map<string, string>();

const memoryStore: Store = {
  getItem: (key) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

function resolve(): Store {
  try {
    const probe = "__ig_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryStore;
  }
}

const store: Store = typeof window === "undefined" ? memoryStore : resolve();

export const safeStorage = {
  get(key: string): string | null {
    if (store !== memoryStore) {
      try {
        const value = store.getItem(key);
        if (value !== null) return value;
      } catch {
        /* fall through to the in-memory copy */
      }
    }
    return memory.has(key) ? memory.get(key)! : null;
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    if (store !== memoryStore) {
      try {
        store.setItem(key, value);
      } catch {
        /* the in-memory copy above keeps the session for this document */
      }
    }
  },
  remove(key: string): void {
    memory.delete(key);
    if (store !== memoryStore) {
      try {
        store.removeItem(key);
      } catch {
        /* nothing else to clear */
      }
    }
  },
  /** True when a real browser storage backend is available (not the fallback). */
  persistent: store !== memoryStore,
};
