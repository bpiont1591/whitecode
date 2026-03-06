let schemaReady = false;

export async function ensureSchema(db) {
  if (!db || schemaReady) return;

  await db.exec(`
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
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      discord_user_display TEXT NOT NULL,
      review TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      webhook_status TEXT NOT NULL DEFAULT 'pending',
      webhook_error TEXT
    );
  `);

  // migration for existing tables without rating column
  try {
    await db.exec(`ALTER TABLE reviews ADD COLUMN rating INTEGER NOT NULL DEFAULT 5;`);
  } catch {
    // column probably already exists
  }

  schemaReady = true;
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
