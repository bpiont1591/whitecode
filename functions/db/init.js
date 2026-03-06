import { ensureSchema, resolveD1DatabaseForUsage } from "../_lib/db.js";

export async function onRequestGet({ env }) {
  try {
    const dbInfo = await resolveD1DatabaseForUsage(env);
    const db = dbInfo.db;
    if (!db) {
      const hint = (dbInfo.reason === "ambiguous" || dbInfo.reason === "probe_failed")
        ? `Wykryto wiele bindingów D1 (${dbInfo.candidates.join(", ")}). Ustaw D1_BINDING_NAME.`
        : "Ustaw poprawny D1 binding lub D1_BINDING_NAME.";

      return json({
        ok: false,
        error: `Brak działającego bindowania D1. ${hint}`,
        error_code: "d1_binding_unavailable",
        reason: dbInfo.reason,
        binding: dbInfo.bindingName || null
      }, 500);
    }

    await ensureSchema(db);
    await runWriteReadDeleteHealthcheck(db);
    return json({
      ok: true,
      binding: dbInfo.bindingName || null,
      reason: dbInfo.reason,
      checks: {
        schema: true,
        write_read_delete: true
      }
    });
  } catch (error) {
    console.error("[db/init] d1 init failed", {
      errorMessage: error instanceof Error ? error.message : String(error)
    });

    return json({
      ok: false,
      error: "Nie udało się zainicjalizować tabel D1.",
      error_code: "schema_migration_failed"
    }, 500);
  }
}

async function runWriteReadDeleteHealthcheck(db) {
  const createdAt = new Date().toISOString();

  const insertRes = await db.prepare(`
    INSERT INTO reviews (
      created_at, discord_user_id, discord_user_display,
      review, rating, webhook_status, webhook_error
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `).bind(
    createdAt,
    "__healthcheck__",
    "__healthcheck__",
    "D1 healthcheck",
    5,
    "skipped",
    null
  ).run();

  const insertedId = insertRes?.meta?.last_row_id;
  if (!insertedId) {
    throw new Error("d1 healthcheck insert returned empty id");
  }

  const row = await db.prepare(`
    SELECT id, review, rating, webhook_status
    FROM reviews
    WHERE id = ?1
    LIMIT 1
  `).bind(insertedId).first();

  if (!row || row.review !== "D1 healthcheck" || Number(row.rating) !== 5 || row.webhook_status !== "skipped") {
    throw new Error("d1 healthcheck read mismatch");
  }

  await db.prepare(`DELETE FROM reviews WHERE id = ?1`).bind(insertedId).run();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
