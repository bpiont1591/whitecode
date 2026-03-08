# whitecode

Strona wspiera:
- logowanie Discord (`/auth/*`) z walidacją OAuth state + nonce,
- formularz kontaktowy (`POST /contact`) z ochroną anty-spam,
- publiczny widget statusu Discord (`GET /discord/status`) z cache,
- publiczne opinie z bota Discord (`GET /opinions`) renderowane na stronie.

System opinii po stronie Pages Functions (stary `/review`) pozostaje wyłączony — opinie są pobierane z Twojego bota i JSON.

## Status Discord na stronie
Frontend cyklicznie pobiera `GET /discord/status` i pokazuje:
- liczbę członków serwera,
- status bota Whitecode (`online` / `offline`),
- status połączenia z API Discord.

### Wymagane zmienne środowiskowe (status)
- `DISCORD_GUILD_ID` — ID serwera Discord.
- `DISCORD_BOT_TOKEN` — token bota (Bot Token).
- `DISCORD_BOT_USER_ID` — ID użytkownika bota (opcjonalnie, zalecane).

## Opinie z bota Discord (JSON)
Strona pobiera opinie przez endpoint proxy:
- `GET /opinions` (plik: `functions/opinions.js`)

### Wymagane zmienne środowiskowe (opinie)
- `BOT_OPINIONS_URL` — URL do endpointu API Twojego bota (np. `https://bot.twojadomena.pl/api/opinions`).
- `BOT_OPINIONS_API_KEY` — opcjonalny klucz API wysyłany w `x-api-key`.

## Jak ma wyglądać event w bocie (gotowy przykład)
Poniżej minimalny, gotowy schemat: zapis opinii do JSON + endpoint `GET /api/opinions`.

```js
import fs from "fs";
import path from "path";
import express from "express";
import { Events } from "discord.js";

const dataDir = path.resolve("./data");
const opinionsPath = path.join(dataDir, "opinions.json");
const API_KEY = process.env.BOT_OPINIONS_API_KEY || "";

function loadOpinions() {
  try {
    return JSON.parse(fs.readFileSync(opinionsPath, "utf-8"));
  } catch {
    return { items: [] };
  }
}

function saveOpinionsAtomically(payload) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${opinionsPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf-8");
  fs.renameSync(tmp, opinionsPath);
}

function appendOpinion(opinion) {
  const db = loadOpinions();
  const items = Array.isArray(db.items) ? db.items : [];
  items.unshift(opinion);
  db.items = items.slice(0, 300); // limit
  saveOpinionsAtomically(db);
}

// endpoint dla strony
export function startOpinionsApi(port = 3001) {
  const app = express();

  app.get("/api/opinions", (req, res) => {
    if (API_KEY && req.header("x-api-key") !== API_KEY) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const db = loadOpinions();
    const items = (db.items || []).slice(0, 30);
    return res.json({ ok: true, items });
  });

  app.listen(port, () => {
    console.log(`Opinions API listening on :${port}`);
  });
}

// fragment eventu modal submit
export async function handleOpinionSubmit(interaction, rating, atmosfera, przebieg, text) {
  const opinion = {
    id: `${Date.now()}_${interaction.user.id}`,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    rating,
    atmosfera,
    przebieg,
    text,
    createdAt: new Date().toISOString()
  };

  appendOpinion(opinion);

  await interaction.reply({
    content: "Dzięki! Opinia zapisana i pokazuje się na stronie.",
    ephemeral: true
  });
}
```

## Kontakt i anty-spam
- cooldown: 45s między wiadomościami,
- max 5 wiadomości / 10 minut,
- przy limicie backend zwraca `429` i `retry_after_sec`.
