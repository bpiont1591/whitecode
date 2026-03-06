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

const ADD_REVIEWS_RATING_SQL = `ALTER TABLE reviews ADD COLUMN rating INTEGER NOT NULL DEFAULT 5`;

export async function ensureSchema(db) {
  if (!db) return;
  if (initializedSchemas.has(db)) return;

  await runSql(db, CREATE_CONTACT_MESSAGES_SQL);
  await runSql(db, CREATE_REVIEWS_SQL);

  // migration for existing tables without rating column
  try {
    await runSql(db, ADD_REVIEWS_RATING_SQL);
  } catch {
    // column probably already exists
  }

  const contactOk = await tableExists(db, "contact_messages");
  const reviewsOk = await tableExists(db, "reviews");
  if (!contactOk || !reviewsOk) {
    throw new Error("schema verification failed");
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
}

export function resolveD1Database(env) {
  return resolveD1DatabaseInfo(env).db;
}

export async function resolveD1DatabaseForUsage(env) {
  const info = resolveD1DatabaseInfo(env);
  if (info.db) return info;

  if (info.reason === "configured_not_found" || info.reason === "no_candidates" || info.reason === "invalid_env") {
    return info;
  }

  const entries = listD1Candidates(env);
  for (const entry of entries) {
    try {
      await ensureSchema(entry.value);
      return {
        db: entry.value,
        bindingName: entry.name,
        reason: info.reason === "ambiguous" ? "auto_probe_ambiguous" : "auto_probe",
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

  const candidates = listD1Candidates(env);

  const configuredBindingName = String(env.D1_BINDING_NAME || "").trim();
  if (configuredBindingName) {
    const configured = candidates.find((it) => it.name === configuredBindingName);
    if (configured) {
      return { db: configured.value, bindingName: configured.name, reason: "configured", candidates: candidates.map((c) => c.name) };
    }
    return { db: null, bindingName: null, reason: "configured_not_found", candidates: candidates.map((c) => c.name) };
  }

  const preferred = [
    "DB",
    "WHITECODE_PROD",
    "whitecode_prod",
    "whitecode-prod",
    "D1",
    "DATABASE"
  ];

  for (const key of preferred) {
    const cand = candidates.find((it) => it.name === key);
    if (cand) {
      return { db: cand.value, bindingName: cand.name, reason: "preferred", candidates: candidates.map((c) => c.name) };
    }
  }

  if (candidates.length === 1) {
    return { db: candidates[0].value, bindingName: candidates[0].name, reason: "single_candidate", candidates: candidates.map((c) => c.name) };
  }

  if (candidates.length > 1) {
    return { db: null, bindingName: null, reason: "ambiguous", candidates: candidates.map((c) => c.name) };
  }

  return { db: null, bindingName: null, reason: "no_candidates", candidates: [] };
}

function listD1Candidates(env) {
  if (!env || typeof env !== "object") return [];

  return Object.entries(env)
    .filter(([, value]) => isD1Binding(value))
    .map(([name, value]) => ({ name, value }));
}

function isD1Binding(obj) {
  return Boolean(
    obj &&
    typeof obj === "object" &&
    typeof obj.prepare === "function" &&
    true
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
