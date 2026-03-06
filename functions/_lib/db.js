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
const CANDIDATE_HINTS_ENV_KEY = "D1_BINDING_CANDIDATES";

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

  // Prefer resilient writes to reviews_v2; legacy reviews may have drifted schema.

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

  const payload = [
    row.created_at,
    row.discord_user_id,
    row.discord_user_display,
    row.review,
    row.rating,
    row.webhook_status,
    row.webhook_error ?? null
  ];

  // 1) Primary durable path: canonical reviews_v2 table.
  try {
    await runSql(db, CREATE_REVIEWS_V2_SQL);
    const v2Stmt = db.prepare(`
      INSERT INTO reviews_v2 (
        created_at, discord_user_id, discord_user_display,
        review, rating, webhook_status, webhook_error
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(...payload);

    const v2Res = await v2Stmt.run();
    return v2Res?.meta?.last_row_id ?? null;
  } catch (v2Error) {
    const v2Message = v2Error instanceof Error ? v2Error.message : String(v2Error);

    // 2) Legacy fallback: try old reviews table with full schema.
    try {
      const fullStmt = db.prepare(`
        INSERT INTO reviews (
          created_at, discord_user_id, discord_user_display,
          review, rating, webhook_status, webhook_error
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `).bind(...payload);
      const fullRes = await fullStmt.run();
      return fullRes?.meta?.last_row_id ?? null;
    } catch (fullError) {
      const fullMessage = fullError instanceof Error ? fullError.message : String(fullError);

      // 3) Deep legacy fallback: reviews without webhook_* columns.
      try {
        const legacyStmt = db.prepare(`
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

        const legacyRes = await legacyStmt.run();
        return legacyRes?.meta?.last_row_id ?? null;
      } catch (legacyError) {
        const legacyMessage = legacyError instanceof Error ? legacyError.message : String(legacyError);
        throw new Error(`saveReview failed: reviews_v2=${v2Message} | reviews=${fullMessage} | reviews_legacy=${legacyMessage}`);
      }
    }
  }
}

export async function listRecentReviews(db, limit = 24) {
  if (!db) return [];

  const n = Math.max(1, Math.min(100, Number(limit) || 24));
  const out = [];

  try {
    const v2 = await db.prepare(`
      SELECT id, created_at, discord_user_id, discord_user_display, review, rating
      FROM reviews_v2
      ORDER BY id DESC
      LIMIT ?1
    `).bind(n).all();

    if (Array.isArray(v2?.results)) out.push(...v2.results);
  } catch {
    // continue
  }

  try {
    const legacy = await db.prepare(`
      SELECT id, created_at, discord_user_id, discord_user_display, review, rating
      FROM reviews
      ORDER BY id DESC
      LIMIT ?1
    `).bind(n).all();

    if (Array.isArray(legacy?.results)) out.push(...legacy.results);
  } catch {
    // continue
  }

  out.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return out.slice(0, n);
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



export function hasD1HttpConfig(env) {
  const accountId = String(env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const dbId = String(env?.D1_DATABASE_ID || "").trim();
  const apiToken = String(env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || "").trim();
  return Boolean(accountId && dbId && apiToken);
}

export async function ensureSchemaViaHttp(env) {
  await runD1HttpSql(env, CREATE_CONTACT_MESSAGES_SQL);
  await runD1HttpSql(env, CREATE_REVIEWS_SQL);
  await runD1HttpSql(env, CREATE_REVIEWS_V2_SQL);

  try { await runD1HttpSql(env, ADD_REVIEWS_RATING_SQL); } catch {}
  try { await runD1HttpSql(env, ADD_REVIEWS_WEBHOOK_STATUS_SQL); } catch {}
  try { await runD1HttpSql(env, ADD_REVIEWS_WEBHOOK_ERROR_SQL); } catch {}
}

export async function saveReviewViaHttp(env, row) {
  await ensureSchemaViaHttp(env);

  const params = [
    row.created_at,
    row.discord_user_id,
    row.discord_user_display,
    row.review,
    row.rating,
    row.webhook_status,
    row.webhook_error ?? null
  ];

  await runD1HttpSql(env, `
    INSERT INTO reviews_v2 (
      created_at, discord_user_id, discord_user_display,
      review, rating, webhook_status, webhook_error
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `, params);

  const rowOut = await runD1HttpFirst(env, `SELECT last_insert_rowid() AS id`);
  return Number(rowOut?.id || 0) || null;
}

export async function listRecentReviewsViaHttp(env, limit = 24) {
  await ensureSchemaViaHttp(env);
  const n = Math.max(1, Math.min(100, Number(limit) || 24));

  const rows = await runD1HttpAll(env, `
    SELECT id, created_at, discord_user_id, discord_user_display, review, rating
    FROM reviews_v2
    ORDER BY id DESC
    LIMIT ?1
  `, [n]);

  return rows;
}

async function runD1HttpSql(env, sql, params = []) {
  const out = await runD1HttpQuery(env, sql, params);
  if (!out.success) {
    throw new Error(out.errors?.[0]?.message || "d1 http sql failed");
  }
  return out;
}

async function runD1HttpAll(env, sql, params = []) {
  const out = await runD1HttpSql(env, sql, params);
  const first = Array.isArray(out.result) ? out.result[0] : null;
  return Array.isArray(first?.results) ? first.results : [];
}

async function runD1HttpFirst(env, sql, params = []) {
  const rows = await runD1HttpAll(env, sql, params);
  return rows[0] || null;
}

async function runD1HttpQuery(env, sql, params = []) {
  const accountId = String(env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const dbId = String(env?.D1_DATABASE_ID || "").trim();
  const apiToken = String(env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || "").trim();

  if (!accountId || !dbId || !apiToken) {
    throw new Error("missing D1 HTTP config (CF_ACCOUNT_ID/CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID, CF_API_TOKEN/CLOUDFLARE_API_TOKEN)");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql, params })
  });

  if (!res.ok) {
    throw new Error(`D1 HTTP API error ${res.status}`);
  }

  return await res.json();
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

  const names = collectEnvKeyCandidates(env);
  const out = [];
  for (const name of names) {
    const value = safeGetEnvKey(env, name);
    if (isD1Binding(value)) {
      out.push({ name, value });
    }
  }

  return out;
}

function listD1CandidatesForProbe(env) {
  const out = [];
  const added = new Set();

  const configuredBindingName = String(env?.D1_BINDING_NAME || "").trim();
  const hintedNames = parseBindingCandidateHints(env?.[CANDIDATE_HINTS_ENV_KEY]);
  const preferred = configuredBindingName
    ? [configuredBindingName, ...hintedNames, ...PREFERRED_BINDING_KEYS]
    : [...hintedNames, ...PREFERRED_BINDING_KEYS];

  for (const key of preferred) {
    const cand = safeGetEnvKey(env, key);
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


function collectEnvKeyCandidates(env) {
  const names = new Set();

  try {
    for (const name of Object.keys(env || {})) {
      if (typeof name === "string" && name) names.add(name);
    }
  } catch {
    // ignore
  }

  try {
    for (const key of Reflect.ownKeys(env || {})) {
      if (typeof key === "string" && key) names.add(key);
    }
  } catch {
    // ignore
  }

  const configured = String(env?.D1_BINDING_NAME || "").trim();
  if (configured) names.add(configured);

  for (const key of PREFERRED_BINDING_KEYS) names.add(key);
  for (const key of parseBindingCandidateHints(env?.[CANDIDATE_HINTS_ENV_KEY])) names.add(key);

  return Array.from(names);
}

function parseBindingCandidateHints(raw) {
  return String(raw || "")
    .split(",")
    .map((it) => it.trim())
    .filter(Boolean);
}

function safeGetEnvKey(env, key) {
  if (!env || typeof env !== "object") return undefined;
  try {
    return env[key];
  } catch {
    return undefined;
  }
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

