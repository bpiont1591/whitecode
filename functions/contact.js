import { readSessionUser } from "./_lib/auth.js";
import { ensureSchema, resolveD1DatabaseInfo, saveContactMessage } from "./_lib/db.js";

export async function onRequestPost({ request, env }) {
  try {
    const user = await readSessionUser(request, env);
    if (!user) {
      return json({ ok: false, error: "Musisz zalogować się przez Discord, aby wysłać wiadomość." }, 401);
    }

    const originError = validateOrigin(request);
    if (originError) {
      return json({ ok: false, error: originError }, 403);
    }

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Nieprawidłowy typ danych." }, 415);
    }

    const data = await request.json();

    const name = String(user.global_name || user.username || "").trim();
    const contact = String(user.sub || "").trim();
    const topic = String(data.topic || "").trim();
    const message = String(data.message || "").trim();

    if (!name || !contact || !topic || !message) {
      return json({ ok: false, error: "Uzupełnij wszystkie pola." }, 400);
    }

    const allowedTopics = new Set(["Bot Discord", "Strona Internetowa", "Inne"]);
    if (!allowedTopics.has(topic)) {
      return json({ ok: false, error: "Wybierz poprawny temat z listy." }, 400);
    }

    if (name.length > 80 || contact.length > 120 || topic.length > 140 || message.length > 4000) {
      return json({ ok: false, error: "Wiadomość jest za długa." }, 400);
    }

    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return json({ ok: false, error: "Brak DISCORD_WEBHOOK_URL w Cloudflare." }, 500);
    }

    const dbInfo = resolveD1DatabaseInfo(env);
    const db = dbInfo.db;

    const discordDisplay = formatDiscordUser(user);
    const createdAt = new Date().toISOString();

    const payload = {
      username: "Kontakt ze strony (WH!TEcode)",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "📩 Nowa wiadomość z formularza",
        description: message.length > 3500 ? (message.slice(0, 3500) + "…") : message,
        color: 0xFFFFFF,
        fields: [
          { name: "🎯 Temat", value: safe(topic), inline: false },
          { name: "👤 Użytkownik Discord", value: `${discordDisplay}\nID: ${safe(user.sub)}`, inline: false }
        ],
        footer: { text: "WH!TEcode • Formularz kontaktowy" },
        timestamp: createdAt
      }]
    };

    let webhookStatus = "sent";
    let webhookError = null;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      webhookStatus = "failed";
      webhookError = `HTTP ${res.status}`;
    }

    if (db) {
      await ensureSchema(db);
      await saveContactMessage(db, {
        created_at: createdAt,
        discord_user_id: safe(user.sub),
        discord_user_display: discordDisplay,
        form_name: safe(name),
        form_contact: safe(contact),
        topic: safe(topic),
        message: safe(message),
        webhook_status: webhookStatus,
        webhook_error: webhookError
      });
    }

    if (!res.ok) {
      return json({ ok: false, error: "Discord webhook odrzucił żądanie, ale wiadomość została zapisana w bazie." }, 502);
    }

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Błąd serwera." }, 500);
  }
}

function validateOrigin(request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const url = new URL(request.url);

  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host !== url.host) return "Niedozwolone źródło żądania.";
    } catch {
      return "Niedozwolone źródło żądania.";
    }
  }

  if (referer) {
    try {
      const r = new URL(referer);
      if (r.host !== url.host) return "Niedozwolone źródło żądania.";
    } catch {
      return "Niedozwolone źródło żądania.";
    }
  }

  return null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function safe(s) {
  const str = String(s || "").trim();
  return str.length ? str : "—";
}

function formatDiscordUser(user) {
  const username = safe(user.username);
  const discr = String(user.discriminator || "0");
  const globalName = String(user.global_name || "").trim();
  const tag = discr && discr !== "0" ? `${username}#${discr}` : username;
  return globalName ? `${globalName} (${tag})` : tag;
}
