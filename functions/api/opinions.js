import { readSessionUser } from "../_lib/auth.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function normalizeRow(row) {
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    userTag: String(row.user_tag || "Użytkownik"),
    rating: Number(row.rating || 5),
    atmosfera: String(row.atmosfera || "—"),
    przebieg: String(row.przebieg || "—"),
    text: String(row.text || ""),
    createdAt: String(row.created_at || "")
  };
}


function formatDiscordDisplayName(user) {
  const username = String(user?.username || "").trim();
  const globalName = String(user?.global_name || "").trim();
  const discr = String(user?.discriminator || "0").trim();

  const tag = username
    ? (discr && discr !== "0" ? `${username}#${discr}` : username)
    : "Użytkownik";

  return globalName ? `${globalName} (${tag})` : tag;
}

function validatePayload(data) {
  const rating = Number(data?.rating);
  const atmosfera = String(data?.atmosfera || "").trim();
  const przebieg = String(data?.przebieg || "").trim();
  const text = String(data?.text || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Ocena musi być liczbą od 1 do 5." };
  }
  if (!atmosfera || atmosfera.length > 120) {
    return { ok: false, error: "Pole 'Atmosfera' jest wymagane (max 120 znaków)." };
  }
  if (!przebieg || przebieg.length > 120) {
    return { ok: false, error: "Pole 'Przebieg' jest wymagane (max 120 znaków)." };
  }
  if (!text || text.length > 2000) {
    return { ok: false, error: "Treść opinii jest wymagana (max 2000 znaków)." };
  }

  return { ok: true, payload: { rating, atmosfera, przebieg, text } };
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ ok: false, error: "Brak bazy D1 (binding DB)." }, 500);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, user_id, user_tag, rating, atmosfera, przebieg, text, created_at
       FROM opinions
       ORDER BY created_at DESC, id DESC
       LIMIT 30`
    ).all();

    const items = Array.isArray(results) ? results.map(normalizeRow) : [];
    return json({ ok: true, items });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Nie udało się pobrać opinii." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ ok: false, error: "Brak bazy D1 (binding DB)." }, 500);
  }

  const user = await readSessionUser(request, env);
  if (!user) {
    return json({ ok: false, error: "Zaloguj się przez Discord, aby dodać opinię." }, 401);
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json({ ok: false, error: "Nieprawidłowy typ danych." }, 415);
  }

  const data = await request.json().catch(() => ({}));
  const validation = validatePayload(data);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, 400);
  }

  const payload = validation.payload;
  const userId = String(user.sub || "").trim();
  const userTag = formatDiscordDisplayName(user);

  if (!userId) {
    return json({ ok: false, error: "Brak ID użytkownika Discord w sesji." }, 401);
  }

  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO opinions (user_id, user_tag, rating, atmosfera, przebieg, text)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       RETURNING id, user_id, user_tag, rating, atmosfera, przebieg, text, created_at`
    )
      .bind(userId, userTag, payload.rating, payload.atmosfera, payload.przebieg, payload.text)
      .first();

    return json({ ok: true, item: normalizeRow(inserted || {}) }, 201);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Nie udało się zapisać opinii." }, 500);
  }
}
