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
  if (!env || typeof env !== "object") return null;

  const configuredBindingName = String(env.D1_BINDING_NAME || "").trim();
  if (configuredBindingName) {
    const configured = env[configuredBindingName];
    if (isD1Binding(configured)) return configured;
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
    const cand = env[key];
    if (isD1Binding(cand)) return cand;
  }

  for (const value of Object.values(env)) {
    if (isD1Binding(value)) return value;
  }

  return null;
}

function isD1Binding(obj) {
  return Boolean(
    obj &&
    typeof obj === "object" &&
    typeof obj.prepare === "function" &&
    (typeof obj.exec === "function" || typeof obj.batch === "function")
  );
}

async function runSql(db, sql) {
  if (typeof db.exec === "function") {
    return await db.exec(sql);
  }

  if (typeof db.batch === "function" && typeof db.prepare === "function") {
    return await db.batch([db.prepare(sql)]);
  }

  throw new Error("unsupported D1 API shape");
}

async function tableExists(db, tableName) {
  const out = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?1 LIMIT 1`
  ).bind(tableName).first();

  return Boolean(out?.name);
}
