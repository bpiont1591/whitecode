import { ensureStorage, getAdminStats } from "../_lib/db.js";

export async function onRequestGet({ env }) {
  try {
    const storage = await ensureStorage(env);
    const stats = await getAdminStats(env);

    return json({
      ok: true,
      mode: storage.mode,
      reason: storage.info?.reason || null,
      checks: {
        schema: storage.mode === "d1" ? true : null,
        profilesCount: stats.profilesCount,
        openReportsCount: stats.openReportsCount
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "Nie udało się zainicjalizować systemu opini.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
