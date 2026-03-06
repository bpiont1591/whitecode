import { ensureSchema, resolveD1DatabaseForUsage } from "./_lib/db.js";

export async function onRequest(context) {
  try {
    const info = await resolveD1DatabaseForUsage(context.env);
    if (info.db) {
      await ensureSchema(info.db);
    }
  } catch {
    // Do not block requests; schema will be attempted again in specific endpoints.
  }

  return context.next();
}
