const CACHE_KEY = "__WC_DC_STATUS_CACHE__";
const CACHE_TTL_MS = 60_000;

function getCache() {
  if (!globalThis[CACHE_KEY]) {
    globalThis[CACHE_KEY] = { value: null, at: 0 };
  }
  return globalThis[CACHE_KEY];
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function fetchGuildStats(env) {
  const guildId = env.DISCORD_GUILD_ID;
  const botToken = env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) {
    throw new Error("Brak DISCORD_GUILD_ID lub DISCORD_BOT_TOKEN");
  }

  const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
    headers: { Authorization: `Bot ${botToken}` }
  });

  if (!guildRes.ok) {
    throw new Error(`Discord guild API error: ${guildRes.status}`);
  }

  const guild = await guildRes.json();

  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${botToken}` }
  });

  if (!meRes.ok) {
    throw new Error(`Discord bot API error: ${meRes.status}`);
  }
  let botStatus = "offline";
  let apiStatus = "online";

  try {
    const widgetRes = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, {
      headers: { "content-type": "application/json" }
    });
    if (widgetRes.ok) {
      const widget = await widgetRes.json();
      const botUserId = env.DISCORD_BOT_USER_ID;
      if (botUserId && Array.isArray(widget.members)) {
        const member = widget.members.find((m) => String(m.id) === String(botUserId));
        botStatus = member?.status || "offline";
      }
    }
  } catch {
    apiStatus = "offline";
  }

  return {
    memberCount: Number.isFinite(guild.approximate_member_count) ? guild.approximate_member_count : null,
    botStatus,
    apiStatus,
    updatedAt: new Date().toISOString(),
    stale: false
  };
}

export async function onRequestGet({ env }) {
  const cache = getCache();
  const now = Date.now();

  if (cache.value && now - cache.at < CACHE_TTL_MS) {
    return json({ ok: true, ...cache.value, stale: false });
  }

  try {
    const fresh = await fetchGuildStats(env);
    cache.value = fresh;
    cache.at = now;
    return json({ ok: true, ...fresh });
  } catch (error) {
    if (cache.value) {
      return json({ ok: true, ...cache.value, stale: true });
    }
    return json({ ok: false, error: error instanceof Error ? error.message : "Nie udało się pobrać statusu Discord." }, 500);
  }
}
