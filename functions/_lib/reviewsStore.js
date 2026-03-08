const MEM_STORE = globalThis.__WC_REVIEWS_MEM_STORE__ || (globalThis.__WC_REVIEWS_MEM_STORE__ = createEmptyStore());
const FILE_CACHE = globalThis.__WC_REVIEWS_FILE_CACHE__ || (globalThis.__WC_REVIEWS_FILE_CACHE__ = new Map());

const DEFAULT_FILE = "data/reviews-db.json";

export async function ensureReviewsSchema(env) {
  const store = await getStore(env);
  const changed = ensureSchemaShape(store.state);
  if (changed && store.mode === "file") {
    await store.persist();
  }
  return {
    mode: store.mode,
    path: store.path || null,
    tables: Object.keys(store.state.tables)
  };
}

export async function saveReview(env, row) {
  const store = await getStore(env);
  ensureSchemaShape(store.state);

  const review = {
    id: `rvw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    created_at: new Date().toISOString(),
    discord_user_id: String(row.discord_user_id || "").trim(),
    discord_user_display: String(row.discord_user_display || "Użytkownik").trim(),
    review: String(row.review || "").trim(),
    rating: Math.max(1, Math.min(5, Number(row.rating || 5)))
  };

  store.state.tables.reviews.unshift(review);
  store.state.tables.reviews = store.state.tables.reviews.slice(0, 200);
  store.state.meta.updated_at = new Date().toISOString();

  if (store.mode === "file") {
    await store.persist();
  }

  return review;
}

export async function listReviews(env, limit = 24) {
  const store = await getStore(env);
  ensureSchemaShape(store.state);
  const n = Math.max(1, Math.min(100, Number(limit) || 24));
  return store.state.tables.reviews.slice(0, n);
}

async function getStore(env) {
  if (isNodeRuntime()) {
    const filePath = String(env?.REVIEWS_JSON_FILE || DEFAULT_FILE);
    if (FILE_CACHE.has(filePath)) return FILE_CACHE.get(filePath);

    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    let state = createEmptyStore();
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state = parsed;
      }
    } catch {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
    }

    ensureSchemaShape(state);

    const persist = async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
    };

    const store = { mode: "file", path: filePath, state, persist };
    FILE_CACHE.set(filePath, store);
    return store;
  }

  ensureSchemaShape(MEM_STORE);
  return { mode: "memory", path: null, state: MEM_STORE, persist: async () => {} };
}

function ensureSchemaShape(state) {
  let changed = false;
  if (!state.tables || typeof state.tables !== "object") {
    state.tables = {};
    changed = true;
  }
  if (!Array.isArray(state.tables.reviews)) {
    state.tables.reviews = [];
    changed = true;
  }
  if (!state.meta || typeof state.meta !== "object") {
    state.meta = {};
    changed = true;
  }
  if (!state.meta.version) {
    state.meta.version = 1;
    changed = true;
  }
  if (!state.meta.created_at) {
    state.meta.created_at = new Date().toISOString();
    changed = true;
  }
  if (!state.meta.updated_at) {
    state.meta.updated_at = state.meta.created_at;
    changed = true;
  }
  return changed;
}

function createEmptyStore() {
  const now = new Date().toISOString();
  return {
    meta: {
      version: 1,
      created_at: now,
      updated_at: now
    },
    tables: {
      reviews: []
    }
  };
}

function isNodeRuntime() {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}
