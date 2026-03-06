const DB_FILE_CACHE = globalThis.__WC_DB_FILE_CACHE__ || (globalThis.__WC_DB_FILE_CACHE__ = new Map());
const MEM_DB = globalThis.__WC_MEM_DB__ || (globalThis.__WC_MEM_DB__ = createEmptyState());
const SCHEMA_READY = new WeakSet();

const CREATE_PROFILES_SQL = `
CREATE TABLE IF NOT EXISTS profiles (
  slug TEXT PRIMARY KEY,
  owner_account TEXT NOT NULL UNIQUE,
  owner_display TEXT,
  owner_avatar TEXT,
  owner_bio TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT
)`;

const CREATE_REVIEWS_SQL = `
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  profile_slug TEXT NOT NULL,
  rating TEXT NOT NULL,
  reason TEXT NOT NULL,
  reviewer_account TEXT NOT NULL,
  reviewer_display TEXT,
  reviewer_avatar TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(profile_slug, reviewer_account)
)`;

const CREATE_REPORTS_SQL = `
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  profile_slug TEXT NOT NULL,
  review_id TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT
)`;

const CREATE_BLOCKED_SQL = `
CREATE TABLE IF NOT EXISTS blocked_accounts (
  account TEXT PRIMARY KEY,
  blocked INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
)`;

const CREATE_MESSAGE_BLOCKS_SQL = `
CREATE TABLE IF NOT EXISTS message_blocks (
  id TEXT PRIMARY KEY,
  profile_slug TEXT NOT NULL,
  account TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(profile_slug, account)
)`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_reviews_profile_created ON reviews(profile_slug, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_account)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_profile_status ON reports(profile_slug, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)`
];

export async function resolveD1DatabaseForUsage(env) {
  const db = env?.DB && typeof env.DB.prepare === "function" ? env.DB : null;
  if (!db) return { db: null, mode: "memory", reason: "missing_db_binding" };
  return { db, mode: "d1", reason: "db_binding" };
}

export async function ensureSchema(db) {
  if (!db || SCHEMA_READY.has(db)) return;
  await runSql(db, CREATE_PROFILES_SQL);
  await runSql(db, CREATE_REVIEWS_SQL);
  await runSql(db, CREATE_REPORTS_SQL);
  await runSql(db, CREATE_BLOCKED_SQL);
  await runSql(db, CREATE_MESSAGE_BLOCKS_SQL);
  for (const sql of INDEXES) await runSql(db, sql);
  SCHEMA_READY.add(db);
}

export async function ensureStorage(env) {
  const info = await resolveD1DatabaseForUsage(env);
  if (info.db) {
    await ensureSchema(info.db);
    return { mode: "d1", db: info.db, info };
  }

  const fileStore = await tryLoadFileStore(env);
  if (fileStore) {
    return { mode: "file", state: fileStore.state, persist: fileStore.persist, info };
  }

  return { mode: "memory", state: MEM_DB, persist: async () => {}, info };
}

export async function saveProfile(env, profile) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const now = isoNow();
    await store.db.prepare(`
      INSERT INTO profiles (slug, owner_account, owner_display, owner_avatar, owner_bio, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)
      ON CONFLICT(slug) DO UPDATE SET
        owner_display = excluded.owner_display,
        owner_avatar = excluded.owner_avatar,
        owner_bio = excluded.owner_bio,
        updated_at = ?7
    `).bind(
      profile.slug,
      profile.owner_account,
      profile.owner_display || null,
      profile.owner_avatar || null,
      profile.owner_bio || "",
      profile.created_at || now,
      now
    ).run();
    return profile;
  }

  const state = store.state;
  const idx = state.profiles.findIndex((p) => p.slug === profile.slug);
  if (idx >= 0) {
    state.profiles[idx] = { ...state.profiles[idx], ...profile, updated_at: isoNow() };
  } else {
    state.profiles.push({ ...profile, created_at: profile.created_at || isoNow(), updated_at: null });
  }
  await store.persist();
  return profile;
}

export async function getProfile(env, slug) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const profile = await store.db.prepare(`SELECT * FROM profiles WHERE slug = ?1 LIMIT 1`).bind(slug).first();
    if (!profile) return null;
    const reviews = await store.db.prepare(`
      SELECT id, profile_slug, rating, reason, reviewer_account, reviewer_display, reviewer_avatar, created_at, updated_at
      FROM reviews WHERE profile_slug = ?1 ORDER BY created_at DESC LIMIT 200
    `).bind(slug).all();
    const reports = await store.db.prepare(`
      SELECT id, profile_slug, review_id, reported_by, reason, status, created_at, updated_at
      FROM reports WHERE profile_slug = ?1 ORDER BY created_at DESC LIMIT 200
    `).bind(slug).all();
    return {
      ...profile,
      reviews: rows(reviews),
      reports: rows(reports)
    };
  }

  const profile = store.state.profiles.find((p) => p.slug === slug);
  if (!profile) return null;
  return {
    ...profile,
    reviews: store.state.reviews.filter((r) => r.profile_slug === slug).sort(sortByCreatedDesc),
    reports: store.state.reports.filter((r) => r.profile_slug === slug).sort(sortByCreatedDesc)
  };
}

export async function getProfileByOwner(env, ownerAccount) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const row = await store.db.prepare(`SELECT slug FROM profiles WHERE owner_account = ?1 LIMIT 1`).bind(ownerAccount).first();
    return row?.slug || null;
  }
  const row = store.state.profiles.find((p) => p.owner_account === ownerAccount);
  return row?.slug || null;
}

export async function deleteProfile(env, slug) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    await store.db.prepare(`DELETE FROM reports WHERE profile_slug = ?1`).bind(slug).run();
    await store.db.prepare(`DELETE FROM reviews WHERE profile_slug = ?1`).bind(slug).run();
    await store.db.prepare(`DELETE FROM message_blocks WHERE profile_slug = ?1`).bind(slug).run();
    const res = await store.db.prepare(`DELETE FROM profiles WHERE slug = ?1`).bind(slug).run();
    return Number(res?.meta?.changes || 0) > 0;
  }

  const before = store.state.profiles.length;
  store.state.profiles = store.state.profiles.filter((p) => p.slug !== slug);
  store.state.reviews = store.state.reviews.filter((r) => r.profile_slug !== slug);
  store.state.reports = store.state.reports.filter((r) => r.profile_slug !== slug);
  store.state.message_blocks = store.state.message_blocks.filter((r) => r.profile_slug !== slug);
  await store.persist();
  return store.state.profiles.length !== before;
}

export async function updateProfileSettings(env, slug, { nextSlug, ownerBio }) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const duplicate = await store.db.prepare(`SELECT slug FROM profiles WHERE slug = ?1 LIMIT 1`).bind(nextSlug).first();
    if (duplicate && duplicate.slug !== slug) return { ok: false, error: "slug_taken" };

    await store.db.prepare(`
      UPDATE profiles
      SET slug = ?1, owner_bio = ?2, updated_at = ?3
      WHERE slug = ?4
    `).bind(nextSlug, ownerBio || "", isoNow(), slug).run();

    if (nextSlug !== slug) {
      await store.db.prepare(`UPDATE reviews SET profile_slug = ?1 WHERE profile_slug = ?2`).bind(nextSlug, slug).run();
      await store.db.prepare(`UPDATE reports SET profile_slug = ?1 WHERE profile_slug = ?2`).bind(nextSlug, slug).run();
      await store.db.prepare(`UPDATE message_blocks SET profile_slug = ?1 WHERE profile_slug = ?2`).bind(nextSlug, slug).run();
    }

    return { ok: true, slug: nextSlug };
  }

  const profile = store.state.profiles.find((p) => p.slug === slug);
  if (!profile) return { ok: false, error: "profile_not_found" };
  const duplicate = store.state.profiles.find((p) => p.slug === nextSlug && p.slug !== slug);
  if (duplicate) return { ok: false, error: "slug_taken" };

  profile.slug = nextSlug;
  profile.owner_bio = ownerBio || "";
  profile.updated_at = isoNow();
  if (nextSlug !== slug) {
    for (const r of store.state.reviews) if (r.profile_slug === slug) r.profile_slug = nextSlug;
    for (const r of store.state.reports) if (r.profile_slug === slug) r.profile_slug = nextSlug;
    for (const r of store.state.message_blocks) if (r.profile_slug === slug) r.profile_slug = nextSlug;
  }
  await store.persist();
  return { ok: true, slug: nextSlug };
}

export async function saveReview(env, reviewRow) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const now = isoNow();
    await store.db.prepare(`
      INSERT INTO reviews (
        id, profile_slug, rating, reason, reviewer_account, reviewer_display, reviewer_avatar, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL)
      ON CONFLICT(profile_slug, reviewer_account) DO UPDATE SET
        rating = excluded.rating,
        reason = excluded.reason,
        reviewer_display = excluded.reviewer_display,
        reviewer_avatar = excluded.reviewer_avatar,
        updated_at = ?9
    `).bind(
      reviewRow.id,
      reviewRow.profile_slug,
      reviewRow.rating,
      reviewRow.reason,
      reviewRow.reviewer_account,
      reviewRow.reviewer_display || null,
      reviewRow.reviewer_avatar || null,
      reviewRow.created_at || now,
      now
    ).run();
    return true;
  }

  const idx = store.state.reviews.findIndex((r) => r.profile_slug === reviewRow.profile_slug && r.reviewer_account === reviewRow.reviewer_account);
  if (idx >= 0) {
    store.state.reviews[idx] = { ...store.state.reviews[idx], ...reviewRow, updated_at: isoNow() };
  } else {
    store.state.reviews.push({ ...reviewRow, created_at: reviewRow.created_at || isoNow(), updated_at: null });
  }
  await store.persist();
  return true;
}



export async function deleteReviewById(env, profileSlug, reviewId) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    await store.db.prepare(`DELETE FROM reviews WHERE profile_slug = ?1 AND id = ?2`).bind(profileSlug, reviewId).run();
    return true;
  }
  const before = store.state.reviews.length;
  store.state.reviews = store.state.reviews.filter((r) => !(r.profile_slug === profileSlug && r.id === reviewId));
  await store.persist();
  return store.state.reviews.length !== before;
}

export async function createReport(env, reportRow) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    await store.db.prepare(`
      INSERT INTO reports (id, profile_slug, review_id, reported_by, reason, status, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'open', ?6, NULL)
    `).bind(
      reportRow.id,
      reportRow.profile_slug,
      reportRow.review_id,
      reportRow.reported_by,
      reportRow.reason || null,
      reportRow.created_at || isoNow()
    ).run();
    return true;
  }

  store.state.reports.push({
    ...reportRow,
    reason: reportRow.reason || null,
    status: "open",
    created_at: reportRow.created_at || isoNow(),
    updated_at: null
  });
  await store.persist();
  return true;
}

export async function resolveReport(env, reportId) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    await store.db.prepare(`UPDATE reports SET status = 'closed', updated_at = ?1 WHERE id = ?2`).bind(isoNow(), reportId).run();
    return true;
  }
  const row = store.state.reports.find((r) => r.id === reportId);
  if (!row) return false;
  row.status = "closed";
  row.updated_at = isoNow();
  await store.persist();
  return true;
}

export async function listOpenReportsGlobal(env) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const out = await store.db.prepare(`
      SELECT r.id AS report_id, r.profile_slug, r.review_id, r.reported_by, r.reason, r.created_at,
             rv.reviewer_account, rv.reviewer_display
      FROM reports r
      LEFT JOIN reviews rv ON rv.id = r.review_id
      WHERE r.status = 'open'
      ORDER BY r.created_at DESC
      LIMIT 200
    `).all();
    return rows(out).map((r) => ({
      reportId: r.report_id,
      profileSlug: r.profile_slug,
      reviewId: r.review_id,
      reportedBy: r.reported_by,
      reason: r.reason,
      createdAt: r.created_at,
      reviewerAccount: r.reviewer_account,
      reviewerDisplay: r.reviewer_display,
      blocked: false
    }));
  }

  return store.state.reports
    .filter((r) => r.status === "open")
    .sort(sortByCreatedDesc)
    .map((r) => {
      const review = store.state.reviews.find((x) => x.id === r.review_id);
      return {
        reportId: r.id,
        profileSlug: r.profile_slug,
        reviewId: r.review_id,
        reportedBy: r.reported_by,
        reason: r.reason,
        createdAt: r.created_at,
        reviewerAccount: review?.reviewer_account || null,
        reviewerDisplay: review?.reviewer_display || null,
        blocked: false
      };
    });
}

export async function getAdminStats(env) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const [profiles, owners, reports, blocked] = await Promise.all([
      store.db.prepare(`SELECT COUNT(*) AS c FROM profiles`).first(),
      store.db.prepare(`SELECT COUNT(DISTINCT owner_account) AS c FROM profiles`).first(),
      store.db.prepare(`SELECT COUNT(*) AS c FROM reports WHERE status = 'open'`).first(),
      store.db.prepare(`SELECT COUNT(*) AS c FROM blocked_accounts WHERE blocked = 1`).first()
    ]);
    return {
      profilesCount: Number(profiles?.c || 0),
      ownersCount: Number(owners?.c || 0),
      openReportsCount: Number(reports?.c || 0),
      blockedAccountsCount: Number(blocked?.c || 0)
    };
  }

  return {
    profilesCount: store.state.profiles.length,
    ownersCount: new Set(store.state.profiles.map((p) => p.owner_account)).size,
    openReportsCount: store.state.reports.filter((r) => r.status === "open").length,
    blockedAccountsCount: store.state.blocked_accounts.filter((x) => x.blocked).length
  };
}

export async function setBlockedAccount(env, { account, blocked, reason }) {
  const store = await ensureStorage(env);
  const blockFlag = blocked ? 1 : 0;
  if (store.mode === "d1") {
    await store.db.prepare(`
      INSERT INTO blocked_accounts (account, blocked, reason, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, NULL)
      ON CONFLICT(account) DO UPDATE SET blocked = ?2, reason = ?3, updated_at = ?5
    `).bind(account, blockFlag, reason || null, isoNow(), isoNow()).run();
    return true;
  }

  const row = store.state.blocked_accounts.find((x) => x.account === account);
  if (row) {
    row.blocked = blockFlag;
    row.reason = reason || null;
    row.updated_at = isoNow();
  } else {
    store.state.blocked_accounts.push({ account, blocked: blockFlag, reason: reason || null, created_at: isoNow(), updated_at: null });
  }
  await store.persist();
  return true;
}

export async function isBlockedAccount(env, account) {
  const store = await ensureStorage(env);
  if (store.mode === "d1") {
    const row = await store.db.prepare(`SELECT blocked FROM blocked_accounts WHERE account = ?1 LIMIT 1`).bind(account).first();
    return Number(row?.blocked || 0) === 1;
  }
  const row = store.state.blocked_accounts.find((x) => x.account === account);
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

function createEmptyState() {
  return {
    profiles: [],
    reviews: [],
    reports: [],
    blocked_accounts: [],
    message_blocks: []
  };
}

function isoNow() {
  return new Date().toISOString();
}

function rows(allResult) {
  if (Array.isArray(allResult?.results)) return allResult.results;
  return [];
}

function sortByCreatedDesc(a, b) {
  return String(b.created_at || "").localeCompare(String(a.created_at || ""));
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
    state = normalizeState(JSON.parse(raw));
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

function normalizeState(raw) {
  const base = createEmptyState();
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base)) {
    if (Array.isArray(raw[key])) base[key] = raw[key];
  }
  return base;
}

async function ensureFile(fs, file, state) {
  const path = await import("node:path");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
}

function isNodeRuntime() {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}
