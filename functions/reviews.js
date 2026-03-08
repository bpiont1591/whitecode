export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ ok: false, error: "Brak konfiguracji bazy (DB)." }, 500);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, author_name, author_role, rating, content, created_at
       FROM reviews
       WHERE is_visible = 1
       ORDER BY created_at DESC
       LIMIT 50`
    ).all();

    return json({ ok: true, reviews: results || [] });
  } catch {
    return json({ ok: false, error: "Nie udało się pobrać opinii." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ ok: false, error: "Brak konfiguracji bazy (DB)." }, 500);
  }

  try {
    const data = await request.json();

    const authorName = String(data.authorName || "").trim();
    const authorRole = String(data.authorRole || "").trim();
    const content = String(data.content || "").trim();
    const rating = Number(data.rating || 0);

    if (!authorName || !content) {
      return json({ ok: false, error: "Uzupełnij wymagane pola opinii." }, 400);
    }

    if (authorName.length > 80 || authorRole.length > 120 || content.length > 1000) {
      return json({ ok: false, error: "Opinia jest za długa." }, 400);
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ ok: false, error: "Ocena musi być od 1 do 5." }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO reviews (author_name, author_role, rating, content, is_visible)
       VALUES (?1, ?2, ?3, ?4, 1)`
    )
      .bind(authorName, authorRole || null, rating, content)
      .run();

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Nie udało się zapisać opinii." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
