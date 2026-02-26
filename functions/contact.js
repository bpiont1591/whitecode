export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    const name = String(data.name || "").trim();
    const contact = String(data.contact || "").trim();
    const topic = String(data.topic || "").trim();
    const message = String(data.message || "").trim();

    if (!name || !contact || !topic || !message) {
      return json({ ok: false, error: "Uzupełnij wszystkie pola." }, 400);
    }

    // twarde limity, żeby nie wysyłać ściany tekstu
    if (name.length > 80 || contact.length > 120 || topic.length > 140 || message.length > 4000) {
      return json({ ok: false, error: "Wiadomość jest za długa." }, 400);
    }

    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return json({ ok: false, error: "Brak DISCORD_WEBHOOK_URL w Cloudflare." }, 500);
    }

    const payload = {
      username: "Kontakt ze strony (WH!TEcode)",
      // blokuje pingowanie @everyone/@here oraz ról przez treść usera
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "Nowa wiadomość z formularza",
        description: message.length > 3500 ? (message.slice(0, 3500) + "…") : message,
        color: 0xFFFFFF,
        fields: [
          { name: "Nick / Imię", value: safe(name), inline: true },
          { name: "Kontakt", value: safe(contact), inline: true },
          { name: "Temat", value: safe(topic), inline: false }
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

// minimalne zabezpieczenie przed pustymi wartościami / psuciem embedów
function safe(s) {
  const str = String(s || "").trim();
  return str.length ? str : "—";
}