import { readSessionUser } from "./_lib/auth.js";

const RATE_LIMIT_STATE = globalThis.__WC_CONTACT_RATE_LIMIT__ || (globalThis.__WC_CONTACT_RATE_LIMIT__ = new Map());
const COOLDOWN_MS = 45 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_IN_WINDOW = 5;

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

    const rateLimitError = checkRateLimit(request, user);
    if (rateLimitError) {
      return json({ ok: false, error: rateLimitError.message, retry_after_sec: rateLimitError.retryAfterSec }, 429);
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

    const discordDisplay = formatDiscordUser(user);
    const createdAt = new Date().toISOString();

    const payload = {
      username: discordDisplay,
      avatar_url: user.avatar
        ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.sub)}/${encodeURIComponent(user.avatar)}.png?size=128`
        : undefined,
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "Nowa wiadomość z formularza",
        description: message.length > 3500 ? (message.slice(0, 3500) + "…") : message,
        color: 0xFFFFFF,
        fields: [
          { name: "Temat", value: safe(topic), inline: false },
          { name: "Użytkownik Discord", value: `${discordDisplay}\nID: ${safe(user.sub)}`, inline: false }
        ],
        footer: { text: "Wiadomość ze strony whitecode.pl" },
        timestamp: createdAt
      }]
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return json({ ok: false, error: "Discord webhook odrzucił żądanie." }, 502);
    }

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Błąd serwera." }, 500);
  }
}

function checkRateLimit(request, user) {
  const now = Date.now();
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "no-ip";
  const userId = String(user?.sub || "unknown");
  const key = `${userId}:${ip}`;

  const current = RATE_LIMIT_STATE.get(key) || { last: 0, hits: [] };

  if (now - current.last < COOLDOWN_MS) {
    const retryMs = COOLDOWN_MS - (now - current.last);
    return {
      message: "Za szybko wysyłasz wiadomości.",
      retryAfterSec: Math.ceil(retryMs / 1000)
    };
  }

  const windowStart = now - WINDOW_MS;
  current.hits = current.hits.filter((ts) => ts >= windowStart);
  if (current.hits.length >= MAX_REQUESTS_IN_WINDOW) {
    const retryMs = current.hits[0] + WINDOW_MS - now;
    return {
      message: "Przekroczono limit wiadomości. Spróbuj później.",
      retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000))
    };
  }

  current.last = now;
  current.hits.push(now);
  RATE_LIMIT_STATE.set(key, current);

  if (RATE_LIMIT_STATE.size > 2000) {
    trimRateLimitMap(now - WINDOW_MS);
  }

  return null;
}

function trimRateLimitMap(cutoff) {
  for (const [key, item] of RATE_LIMIT_STATE.entries()) {
    const recentHits = (item.hits || []).filter((ts) => ts >= cutoff);
    if (!recentHits.length && item.last < cutoff) {
      RATE_LIMIT_STATE.delete(key);
    } else {
      item.hits = recentHits;
      RATE_LIMIT_STATE.set(key, item);
    }
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
