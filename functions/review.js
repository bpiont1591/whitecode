import { readSessionUser } from "./_lib/auth.js";

const DEFAULT_REVIEWER_ROLE_ID = "1448144394426388622";

export async function onRequestPost({ request, env }) {
  try {
    const user = await readSessionUser(request, env);
    if (!user) {
      return json({ ok: false, error: "Musisz zalogować się przez Discord." }, 401);
    }

    const originError = validateOrigin(request);
    if (originError) return json({ ok: false, error: originError }, 403);

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Nieprawidłowy typ danych." }, 415);
    }

    const data = await request.json();
    const review = String(data.review || "").trim();

    if (!review) return json({ ok: false, error: "Wpisz treść opinii." }, 400);
    if (review.length > 1200) return json({ ok: false, error: "Opinia jest za długa (max 1200)." }, 400);

    const guildId = env.DISCORD_GUILD_ID;
    const botToken = env.DISCORD_BOT_TOKEN;
    const reviewerRoleId = env.REVIEWER_ROLE_ID || DEFAULT_REVIEWER_ROLE_ID;

    if (!guildId || !botToken) {
      return json({ ok: false, error: "Brak DISCORD_GUILD_ID lub DISCORD_BOT_TOKEN w konfiguracji." }, 500);
    }

    const member = await fetchGuildMember(guildId, user.sub, botToken);
    if (!member) {
      return json({ ok: false, error: "Musisz być członkiem naszego serwera Discord." }, 403);
    }

    const roles = Array.isArray(member.roles) ? member.roles : [];
    if (!roles.includes(reviewerRoleId)) {
      return json({ ok: false, error: "Tylko osoby z odpowiednią rangą mogą dodać opinię." }, 403);
    }

    const webhookUrl = env.REVIEW_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return json({ ok: false, error: "Brak REVIEW_WEBHOOK_URL / DISCORD_WEBHOOK_URL." }, 500);

    const discordDisplay = formatDiscordUser(user);
    const payload = {
      username: "Opinie ze strony (WH!TEcode)",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "⭐ Nowa opinia ze strony",
        description: review,
        color: 0xFFFFFF,
        fields: [
          { name: "👤 Autor", value: `${discordDisplay}\nID: ${safe(user.sub)}`, inline: false }
        ],
        footer: { text: "WH!TEcode • Opinie" },
        timestamp: new Date().toISOString()
      }]
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return json({ ok: false, error: "Discord webhook odrzucił opinię." }, 502);

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Błąd serwera." }, 500);
  }
}

async function fetchGuildMember(guildId, userId, botToken) {
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("guild member fetch failed");
  return await res.json();
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
