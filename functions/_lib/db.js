const initializedSchemas = new WeakSet();

const CREATE_CONTACT_MESSAGES_SQL = `
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    discord_user_display TEXT NOT NULL,
    form_name TEXT NOT NULL,
    form_contact TEXT NOT NULL,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    webhook_status TEXT NOT NULL DEFAULT 'pending',
    webhook_error TEXT
  )
`;

const CREATE_REVIEWS_SQL = `
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    discord_user_display TEXT NOT NULL,
    review TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    webhook_status TEXT NOT NULL DEFAULT 'pending',
    webhook_error TEXT
  )
`;

const CREATE_REVIEWS_V2_SQL = `
  CREATE TABLE IF NOT EXISTS reviews_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    discord_user_display TEXT NOT NULL,
    review TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    webhook_status TEXT NOT NULL DEFAULT 'pending',
    webhook_error TEXT
  )
`;

const ADD_REVIEWS_RATING_SQL = `ALTER TABLE reviews ADD COLUMN rating INTEGER NOT NULL DEFAULT 5`;
const ADD_REVIEWS_WEBHOOK_STATUS_SQL = `ALTER TABLE reviews ADD COLUMN webhook_status TEXT NOT NULL DEFAULT 'pending'`;
const ADD_REVIEWS_WEBHOOK_ERROR_SQL = `ALTER TABLE reviews ADD COLUMN webhook_error TEXT`;

const PREFERRED_BINDING_KEYS = ["DB", "WHITECODE_PROD", "whitecode_prod", "whitecode-prod", "D1", "DATABASE"];

export async function ensureSchema(db) {
  if (!db) return;
  if (initializedSchemas.has(db)) return;

  await runSql(db, CREATE_CONTACT_MESSAGES_SQL);
  await runSql(db, CREATE_REVIEWS_SQL);
  await runSql(db, CREATE_REVIEWS_V2_SQL);

  // migration for existing tables without rating column
  try {
    await runSql(db, ADD_REVIEWS_RATING_SQL);
  } catch {
    // column probably already exists
  }

  try {
    await runSql(db, ADD_REVIEWS_WEBHOOK_STATUS_SQL);
  } catch {
    // column probably already exists
  }

  try {
    await runSql(db, ADD_REVIEWS_WEBHOOK_ERROR_SQL);
  } catch {
    // column probably already exists
  }

  const contactOk = await tableExists(db, "contact_messages");
  const reviewsOk = await tableExists(db, "reviews");
  const reviewsV2Ok = await tableExists(db, "reviews_v2");
  if (!contactOk || !reviewsOk || !reviewsV2Ok) {
    throw new Error("schema verification failed");
  }

  const reviewColumns = await listTableColumns(db, "reviews");
  const expectedReviewColumns = [
    "created_at",
    "discord_user_id",
    "discord_user_display",
    "review",
    "rating",
    "webhook_status",
    "webhook_error"
  ];

  for (const col of expectedReviewColumns) {
    if (!reviewColumns.has(col)) {
      throw new Error(`reviews schema mismatch: missing column ${col}`);
    }
  }

  initializedSchemas.add(db);
}

export async function saveContactMessage(db, row) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO contact_messages (
      created_at, discord_user_id, discord_user_display,
      form_name, form_contact, topic, message,
      webhook_status, webhook_error
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
  `).bind(
    row.created_at,
    row.discord_user_id,
    row.discord_user_display,
    row.form_name,
    row.form_contact,
    row.topic,
    row.message,
    row.webhook_status,
    row.webhook_error ?? null
  );

  const res = await stmt.run();
  return res?.meta?.last_row_id ?? null;
}

export async function saveReview(db, row) {
  if (!db) return null;

  try {
    const stmt = db.prepare(`
      INSERT INTO reviews (
        created_at, discord_user_id, discord_user_display,
        review, rating, webhook_status, webhook_error
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(
      row.created_at,
      row.discord_user_id,
      row.discord_user_display,
      row.review,
      row.rating,
      row.webhook_status,
      row.webhook_error ?? null
    );

    const res = await stmt.run();
    return res?.meta?.last_row_id ?? null;
  } catch (error) {
    // compatibility fallback for legacy tables that may still miss webhook_* columns
    const message = error instanceof Error ? error.message : String(error);
    const mentionsWebhookColumn = /webhook_status|webhook_error|no such column/i.test(message);
    const mentionsCoreReviewColumn = /created_at|discord_user_id|discord_user_display|review|rating|no such column/i.test(message);

    if (mentionsWebhookColumn) {
      const fallbackStmt = db.prepare(`
        INSERT INTO reviews (
          created_at, discord_user_id, discord_user_display,
          review, rating
        ) VALUES (?1, ?2, ?3, ?4, ?5)
      `).bind(
        row.created_at,
        row.discord_user_id,
        row.discord_user_display,
        row.review,
        row.rating
      );

      const fallbackRes = await fallbackStmt.run();
      return fallbackRes?.meta?.last_row_id ?? null;
    }

    if (mentionsCoreReviewColumn) {
      const v2Stmt = db.prepare(`
        INSERT INTO reviews_v2 (
          created_at, discord_user_id, discord_user_display,
          review, rating, webhook_status, webhook_error
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `).bind(
        row.created_at,
        row.discord_user_id,
        row.discord_user_display,
        row.review,
        row.rating,
        row.webhook_status,
        row.webhook_error ?? null
      );

      const v2Res = await v2Stmt.run();
      return v2Res?.meta?.last_row_id ?? null;
    }

    throw error;
  }
}

export async function listRecentReviews(db, limit = 24) {
  if (!db) return [];

  const n = Math.max(1, Math.min(100, Number(limit) || 24));

  try {
    const out = await db.prepare(`
      SELECT id, created_at, discord_user_id, discord_user_display, review, rating
      FROM reviews
      ORDER BY id DESC
      LIMIT ?1
    `).bind(n).all();

    const items = Array.isArray(out?.results) ? out.results : [];
    if (items.length > 0) return items;
  } catch {
    // fallback to reviews_v2 below
  }

  const v2Out = await db.prepare(`
    SELECT id, created_at, discord_user_id, discord_user_display, review, rating
    FROM reviews_v2
    ORDER BY id DESC
    LIMIT ?1
  `).bind(n).all();

  return Array.isArray(v2Out?.results) ? v2Out.results : [];
}

export async function deleteReviewById(db, id) {
  if (!db) return;

  try {
    await db.prepare(`DELETE FROM reviews WHERE id = ?1`).bind(id).run();
  } catch {
    // continue to v2 attempt
  }

  await db.prepare(`DELETE FROM reviews_v2 WHERE id = ?1`).bind(id).run();
}

export function resolveD1Database(env) {
  return resolveD1DatabaseInfo(env).db;
}

export async function resolveD1DatabaseForUsage(env) {
  const info = resolveD1DatabaseInfo(env);
  if (info.db) return info;

  if (info.reason === "no_candidates" || info.reason === "invalid_env") {
    return info;
  }

  const entries = listD1CandidatesForProbe(env);
  for (const entry of entries) {
    try {
      await ensureSchema(entry.value);
      return {
        db: entry.value,
        bindingName: entry.name,
        reason: info.reason.includes("ambiguous") ? "auto_probe_ambiguous" : "auto_probe",
        candidates: entries.map((it) => it.name)
      };
    } catch {
      // try next candidate
    }
  }

  return {
    db: null,
    bindingName: null,
    reason: "probe_failed",
    candidates: entries.map((it) => it.name)
  };
}

export function resolveD1DatabaseInfo(env) {
  if (!env || typeof env !== "object") {
    return { db: null, bindingName: null, reason: "invalid_env", candidates: [] };
  }

  const candidateNames = listD1CandidateNames(env);
  const configuredBindingName = String(env.D1_BINDING_NAME || "").trim();
  const configuredExists = configuredBindingName && isD1Binding(env[configuredBindingName]);

  if (configuredExists) {
    return {
      db: env[configuredBindingName],
      bindingName: configuredBindingName,
      reason: "configured",
      candidates: candidateNames
    };
  }

  for (const key of PREFERRED_BINDING_KEYS) {
    const cand = env[key];
    if (isD1Binding(cand)) {
      return {
        db: cand,
        bindingName: key,
        reason: configuredBindingName ? "configured_not_found_fallback" : "preferred",
        candidates: candidateNames
      };
    }
  }

  const candidates = listD1Candidates(env);
  if (candidates.length === 1) {
    return {
      db: candidates[0].value,
      bindingName: candidates[0].name,
      reason: configuredBindingName ? "configured_not_found_single_candidate" : "single_candidate",
      candidates: candidates.map((c) => c.name)
    };
  }

  if (candidates.length > 1) {
    return {
      db: null,
      bindingName: null,
      reason: configuredBindingName ? "configured_not_found_ambiguous" : "ambiguous",
      candidates: candidates.map((c) => c.name)
    };
  }

  return {
    db: null,
    bindingName: null,
    reason: configuredBindingName ? "configured_not_found" : "no_candidates",
    candidates: []
  };
}

function listD1Candidates(env) {
  if (!env || typeof env !== "object") return [];

  return Object.entries(env)
    .filter(([, value]) => isD1Binding(value))
    .map(([name, value]) => ({ name, value }));
}

function listD1CandidatesForProbe(env) {
  const out = [];
  const added = new Set();

  const configuredBindingName = String(env?.D1_BINDING_NAME || "").trim();
  const preferred = configuredBindingName
    ? [configuredBindingName, ...PREFERRED_BINDING_KEYS]
    : [...PREFERRED_BINDING_KEYS];

  for (const key of preferred) {
    const cand = env?.[key];
    if (isD1Binding(cand) && !added.has(key)) {
      out.push({ name: key, value: cand });
      added.add(key);
    }
  }

  for (const item of listD1Candidates(env)) {
    if (!added.has(item.name)) {
      out.push(item);
      added.add(item.name);
    }
  }

  return out;
}

function listD1CandidateNames(env) {
  return listD1CandidatesForProbe(env).map((it) => it.name);
}

function isD1Binding(obj) {
  return Boolean(
    obj &&
    typeof obj === "object" &&
    typeof obj.prepare === "function"
  );
}

async function runSql(db, sql) {
  if (typeof db.exec === "function") {
    return await db.exec(sql);
  }

  if (typeof db.prepare === "function") {
    const stmt = db.prepare(sql);
    if (typeof stmt.run === "function") {
      return await stmt.run();
    }

    if (typeof db.batch === "function") {
      return await db.batch([stmt]);
    }
  }

  throw new Error("unsupported D1 API shape");
}

async function tableExists(db, tableName) {
  const stmt = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?1 LIMIT 1`
  ).bind(tableName);

  if (typeof stmt.first === "function") {
    const out = await stmt.first();
    return Boolean(out?.name);
  }

  if (typeof stmt.all === "function") {
    const out = await stmt.all();
    return Array.isArray(out?.results) && out.results.length > 0;
  }

  throw new Error("unsupported query API shape");
}

async function listTableColumns(db, tableName) {
  const stmt = db.prepare(`PRAGMA table_info(${escapeSqlIdentifier(tableName)})`);

  if (typeof stmt.all === "function") {
    const out = await stmt.all();
    const rows = Array.isArray(out?.results) ? out.results : [];
    return new Set(rows.map((row) => String(row.name || "")).filter(Boolean));
  }

  throw new Error("unsupported query API shape");
}

function escapeSqlIdentifier(name) {
  return String(name || "").replace(/[^a-zA-Z0-9_]/g, "");
}
