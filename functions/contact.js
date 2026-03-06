import { readSessionUser } from "./_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const user = await readSessionUser(request, env);
    if (!user) {
      return json({ ok: false, error: "Musisz zalogować się przez Discord, aby wysłać wiadomość." }, 401);
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
    const payload = {
      username: "Kontakt ze strony (WH!TEcode)",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "Nowa wiadomość z formularza",
        description: message.length > 3500 ? (message.slice(0, 3500) + "…") : message,
        color: 0xFFFFFF,
        fields: [
          { name: "Nick / Imię", value: safe(name), inline: true },
          { name: "Kontakt", value: safe(contact), inline: true },
          { name: "Temat", value: safe(topic), inline: false },
          { name: "Discord user", value: discordDisplay, inline: true },
          { name: "Discord ID", value: safe(user.sub), inline: true }
        ],
        timestamp: new Date().toISOString()
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
