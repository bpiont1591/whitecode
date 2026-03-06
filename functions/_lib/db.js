const MEM_DB = globalThis.__WC_MEM_DB__ || (globalThis.__WC_MEM_DB__ = createEmptyState());
const DB_FILE_CACHE = globalThis.__WC_DB_FILE_CACHE__ || (globalThis.__WC_DB_FILE_CACHE__ = new Map());
const SCHEMA_READY = new WeakSet();

const CREATE_REVIEWS_SQL = `
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_user_display TEXT NOT NULL,
  review TEXT NOT NULL,
  rating INTEGER NOT NULL
)`;

const CREATE_REVIEWS_CREATED_AT_INDEX = `CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC)`;

const ADD_CREATED_AT_SQL = `ALTER TABLE reviews ADD COLUMN created_at TEXT`;
const ADD_DISCORD_ID_SQL = `ALTER TABLE reviews ADD COLUMN discord_user_id TEXT`;
const ADD_DISCORD_DISPLAY_SQL = `ALTER TABLE reviews ADD COLUMN discord_user_display TEXT`;
const ADD_REVIEW_SQL = `ALTER TABLE reviews ADD COLUMN review TEXT`;
const ADD_RATING_SQL = `ALTER TABLE reviews ADD COLUMN rating INTEGER`;

const PREFERRED_BINDINGS = ["DB", "D1", "DATABASE", "WHITECODE_DB", "whitcode_db", "whitecode-db"];

export async function resolveD1DatabaseForUsage(env) {
  const hintName = String(env?.D1_BINDING_NAME || "").trim();
  const candidatesFromEnv = parseCandidates(env?.D1_BINDING_CANDIDATES);

  const preferred = [hintName, ...candidatesFromEnv, ...PREFERRED_BINDINGS].filter(Boolean);
  for (const key of preferred) {
    const db = safeGetEnvKey(env, key);
    if (isD1Like(db)) return { db, mode: "d1", reason: `binding:${key}`, bindingName: key };
  }

  const scannedKeys = collectEnvKeys(env);
  for (const key of scannedKeys) {
    const db = safeGetEnvKey(env, key);
    if (isD1Like(db)) return { db, mode: "d1", reason: `scan:${key}`, bindingName: key };
  }

  return { db: null, mode: "memory", reason: "missing_db_binding", bindingName: null };
}

export async function ensureSchema(db) {
  if (!db || SCHEMA_READY.has(db)) return;

  await runSql(db, CREATE_REVIEWS_SQL);
  await runSql(db, CREATE_REVIEWS_CREATED_AT_INDEX);

  // legacy schema support (if old reviews table exists with different columns)
  for (const sql of [ADD_CREATED_AT_SQL, ADD_DISCORD_ID_SQL, ADD_DISCORD_DISPLAY_SQL, ADD_REVIEW_SQL, ADD_RATING_SQL]) {
    try {
      await runSql(db, sql);
    } catch {
      // already exists or incompatible runtime, ignore here and rely on insert fallbacks
    }
  }

  const exists = await tableExists(db, "reviews");
  if (!exists) throw new Error("reviews table not found after ensureSchema");

  SCHEMA_READY.add(db);
}

export async function ensureStorage(env) {
  const info = await resolveD1DatabaseForUsage(env);
  if (info.db) {
    await ensureSchema(info.db);
    return { mode: "d1", db: info.db, info };
  }

  const fileStore = await tryLoadFileStore(env);
  if (fileStore) return { mode: "file", state: fileStore.state, persist: fileStore.persist, info };

  return { mode: "memory", state: MEM_DB, persist: async () => {}, info };
}

export async function saveReview(env, row) {
  const store = await ensureStorage(env);
  const normalized = normalizeReviewRow(row);

  if (store.mode === "d1") {
    // Preferred schema
    try {
      await store.db.prepare(`
        INSERT INTO reviews (created_at, discord_user_id, discord_user_display, review, rating)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `).bind(
        normalized.created_at,
        normalized.discord_user_id,
        normalized.discord_user_display,
        normalized.review,
        normalized.rating
      ).run();
      return true;
    } catch (firstError) {
      // Legacy fallback where table may use old columns
      try {
        await store.db.prepare(`
          INSERT INTO reviews (id, profile_slug, rating, reason, reviewer_account, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)
        `).bind(
          createReviewId(),
          normalized.profile_slug || "whitecode",
          fromStarsToLegacy(normalized.rating),
          normalized.review,
          normalized.reviewer_account || `dc_${normalized.discord_user_id}`,
          normalized.created_at
        ).run();
        return true;
      } catch (secondError) {
        throw new Error(`saveReview failed: primary=${errorMsg(firstError)} fallback=${errorMsg(secondError)}`);
      }
    }
  }

  store.state.reviews.push({ id: normalized.id || createReviewId(), ...normalized });
  await store.persist();
  return true;
}

export async function listRecentReviews(env, limit = 24) {
  const n = Math.max(1, Math.min(100, Number(limit) || 24));
  const store = await ensureStorage(env);

  if (store.mode === "d1") {
    // Preferred schema
    try {
      const out = await store.db.prepare(`
        SELECT id, created_at, discord_user_id, discord_user_display, review, rating
        FROM reviews
        ORDER BY id DESC
        LIMIT ?1
      `).bind(n).all();
      return rows(out).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        discord_user_id: r.discord_user_id,
        discord_user_display: r.discord_user_display,
        review: r.review,
        rating: normalizeRating(r.rating)
      }));
    } catch {
      // Legacy fallback (profile system schema)
      const out = await store.db.prepare(`
        SELECT id, created_at, reviewer_account, reason, rating
        FROM reviews
        ORDER BY created_at DESC
        LIMIT ?1
      `).bind(n).all();
      return rows(out).map((r) => {
        const id = String(r.reviewer_account || "").replace(/^dc_/, "");
        return {
          id: r.id,
          created_at: r.created_at || new Date().toISOString(),
          discord_user_id: id,
          discord_user_display: r.reviewer_account || "Użytkownik",
          review: r.reason || "",
          rating: normalizeRating(r.rating)
        };
      });
    }
  }

  return [...store.state.reviews]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, n);
}

export async function hasReviewsTable(env) {
  const info = await resolveD1DatabaseForUsage(env);
  if (!info.db) return false;
  return tableExists(info.db, "reviews");
}

export async function deleteReviewById(env, _profileSlug, reviewId) {
  const store = await ensureStorage(env);

  if (store.mode === "d1") {
    const id = Number(reviewId);
    if (!Number.isFinite(id)) return false;
    const res = await store.db.prepare(`DELETE FROM reviews WHERE id = ?1`).bind(id).run();
    return Number(res?.meta?.changes || 0) > 0;
  }

  const before = store.state.reviews.length;
  store.state.reviews = store.state.reviews.filter((r) => String(r.id) !== String(reviewId));
  await store.persist();
  return store.state.reviews.length !== before;
}

// ---- Compatibility helpers for previously added profile/admin endpoints ----

export async function saveProfile(_env, profile) {
  const idx = MEM_DB.profiles.findIndex((p) => p.slug === profile.slug);
  if (idx >= 0) MEM_DB.profiles[idx] = { ...MEM_DB.profiles[idx], ...profile };
  else MEM_DB.profiles.push({ ...profile });
  return profile;
}

export async function getProfile(_env, slug) {
  const reviews = MEM_DB.reviews
    .filter((r) => String(r.profile_slug || "") === String(slug))
    .map((r) => ({
      id: r.id,
      profile_slug: r.profile_slug,
      rating: r.rating_legacy || fromStarsToLegacy(r.rating),
      reason: r.review,
      reviewer_account: r.reviewer_account || `dc_${r.discord_user_id}`,
      reviewer_display: r.discord_user_display,
      reviewer_avatar: r.reviewer_avatar || null,
      created_at: r.created_at,
      updated_at: null
    }));

  const profile = MEM_DB.profiles.find((p) => p.slug === slug);
  if (!profile && !reviews.length) return null;

  return {
    slug,
    owner_account: profile?.owner_account || "system",
    owner_display: profile?.owner_display || "System",
    owner_avatar: profile?.owner_avatar || null,
    owner_bio: profile?.owner_bio || "",
    reviews,
    reports: MEM_DB.reports.filter((r) => r.profile_slug === slug)
  };
}

export async function getProfileByOwner(_env, ownerAccount) {
  return MEM_DB.profiles.find((p) => p.owner_account === ownerAccount)?.slug || null;
}

export async function deleteProfile(_env, slug) {
  MEM_DB.profiles = MEM_DB.profiles.filter((p) => p.slug !== slug);
  MEM_DB.reviews = MEM_DB.reviews.filter((r) => r.profile_slug !== slug);
  MEM_DB.reports = MEM_DB.reports.filter((r) => r.profile_slug !== slug);
  return true;
}

export async function updateProfileSettings(_env, slug, { nextSlug, ownerBio }) {
  const profile = MEM_DB.profiles.find((p) => p.slug === slug);
  if (!profile) return { ok: false, error: "profile_not_found" };
  const duplicate = MEM_DB.profiles.find((p) => p.slug === nextSlug && p.slug !== slug);
  if (duplicate) return { ok: false, error: "slug_taken" };
  profile.slug = nextSlug;
  profile.owner_bio = ownerBio || "";
  return { ok: true, slug: nextSlug };
}

export async function createReport(_env, reportRow) {
  MEM_DB.reports.push({ ...reportRow, status: "open" });
  return true;
}

export async function resolveReport(_env, reportId) {
  const row = MEM_DB.reports.find((r) => String(r.id) === String(reportId));
  if (!row) return false;
  row.status = "closed";
  return true;
}

export async function listOpenReportsGlobal() {
  return MEM_DB.reports.filter((r) => r.status === "open").map((r) => ({
    reportId: r.id,
    profileSlug: r.profile_slug,
    reviewId: r.review_id,
    reportedBy: r.reported_by,
    reason: r.reason,
    createdAt: r.created_at,
    reviewerAccount: null,
    reviewerDisplay: null,
    blocked: false
  }));
}

export async function getAdminStats() {
  return {
    profilesCount: MEM_DB.profiles.length,
    ownersCount: new Set(MEM_DB.profiles.map((p) => p.owner_account)).size,
    openReportsCount: MEM_DB.reports.filter((r) => r.status === "open").length,
    blockedAccountsCount: MEM_DB.blocked_accounts.filter((b) => b.blocked).length
  };
}

export async function setBlockedAccount(_env, { account, blocked, reason }) {
  const row = MEM_DB.blocked_accounts.find((b) => b.account === account);
  if (row) {
    row.blocked = blocked ? 1 : 0;
    row.reason = reason || null;
  } else {
    MEM_DB.blocked_accounts.push({ account, blocked: blocked ? 1 : 0, reason: reason || null });
  }
  return true;
}

export async function isBlockedAccount(_env, account) {
  const row = MEM_DB.blocked_accounts.find((b) => b.account === account);
  return Number(row?.blocked || 0) === 1;
}

export function createReviewId() {
  return `rvw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createReportId() {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeAccountFromSession(user) {
  return `dc_${String(user?.sub || "")}`;
}

export function normalizeDisplayFromSession(user) {
  return String(user?.global_name || user?.username || "Użytkownik").trim();
}

export function normalizeAvatarFromSession(user) {
  const id = String(user?.sub || "").trim();
  const avatar = String(user?.avatar || "").trim();
  if (id && avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
  return null;
}

function normalizeReviewRow(row) {
  const ratingNum = normalizeRating(row.rating);
  const reviewText = String(row.review ?? row.reason ?? "").trim();
  const discordId = String(row.discord_user_id || row.reviewer_account || "").replace(/^dc_/, "").trim();
  const display = String(row.discord_user_display || row.reviewer_display || row.reviewer_account || "Użytkownik").trim();

  return {
    id: row.id || null,
    created_at: String(row.created_at || new Date().toISOString()),
    discord_user_id: discordId || "unknown",
    discord_user_display: display || "Użytkownik",
    review: reviewText,
    rating: ratingNum,
    profile_slug: row.profile_slug || null,
    reviewer_account: row.reviewer_account || (discordId ? `dc_${discordId}` : "")
  };
}

function normalizeRating(value) {
  if (Number.isInteger(value)) return Math.max(1, Math.min(5, value));
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "scam") return 1;
  if (raw === "sold") return 3;
  if (raw === "legit") return 5;
  const num = Number(raw);
  if (Number.isInteger(num)) return Math.max(1, Math.min(5, num));
  return 5;
}

function fromStarsToLegacy(stars) {
  const n = normalizeRating(stars);
  if (n <= 2) return "scam";
  if (n === 3) return "sold";
  return "legit";
}

function rows(allResult) {
  return Array.isArray(allResult?.results) ? allResult.results : [];
}

function errorMsg(err) {
  return err instanceof Error ? err.message : String(err);
}

function isD1Like(obj) {
  return Boolean(obj && typeof obj.prepare === "function" && (typeof obj.exec === "function" || typeof obj.batch === "function" || typeof obj.prepare === "function"));
}

function safeGetEnvKey(env, key) {
  try {
    return env?.[key];
  } catch {
    return null;
  }
}

function collectEnvKeys(env) {
  const out = new Set();
  if (!env || typeof env !== "object") return [];
  for (const k of Object.keys(env)) out.add(k);
  for (const k of Reflect.ownKeys(env)) if (typeof k === "string") out.add(k);
  return [...out];
}

function parseCandidates(raw) {
  return String(raw || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

async function tableExists(db, tableName) {
  try {
    const row = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?1 LIMIT 1`).bind(tableName).first();
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

async function runSql(db, sql) {
  if (typeof db.exec === "function") {
    await db.exec(sql);
    return;
  }
  const stmt = db.prepare(sql);
  if (typeof stmt.run === "function") {
    await stmt.run();
    return;
  }
  if (typeof db.batch === "function") {
    await db.batch([stmt]);
    return;
  }
  throw new Error("Unsupported D1 runtime");
}

function createEmptyState() {
  return {
    profiles: [],
    reviews: [],
    reports: [],
    blocked_accounts: []
  };
}

async function tryLoadFileStore(env) {
  if (!isNodeRuntime()) return null;
  let fs;
  try {
    fs = await import("node:fs/promises");
  } catch {
    return null;
  }

  const file = String(env?.LOCAL_DB_FILE || "data/profiles-db.json");
  if (DB_FILE_CACHE.has(file)) return DB_FILE_CACHE.get(file);

  let state = createEmptyState();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = {
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        blocked_accounts: Array.isArray(parsed.blocked_accounts) ? parsed.blocked_accounts : []
      };
    }
  } catch {
    await ensureFile(fs, file, state);
  }

  const persist = async () => {
    await ensureFile(fs, file, state);
  };

  const store = { state, persist };
  DB_FILE_CACHE.set(file, store);
  return store;
}

async function ensureFile(fs, file, state) {
  const path = await import("node:path");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
}

function isNodeRuntime() {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}
