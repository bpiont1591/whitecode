# whitecode

Strona wspiera:
- logowanie Discord (`/auth/*`) z walidacją OAuth state + nonce,
- formularz kontaktowy (`POST /contact`) z ochroną anty-spam,
- publiczny widget statusu Discord (`GET /discord/status`) z cache,
- publiczne opinie z bota Discord pobierane bezpośrednio z `GET /api/opinions`.

System opinii po stronie Pages Functions (stary `/review`) pozostaje wyłączony.

## Co było zepsute i co naprawiono
Problem wynikał z niespójności kontraktu API: frontend dostawał odpowiedź inną niż oczekiwane JSON (`{ ok: true, items: [] }`) albo HTML (`200`), przez co pokazywał błąd „Niepoprawna odpowiedź endpointu opinii (200)”.

Naprawa:
- frontend pobiera teraz bezpośrednio `fetch("/api/opinions")`,
- frontend waliduje `content-type` i wymaga struktury `{ ok, items }`,
- backend bota (poniżej) zawsze zwraca poprawny JSON,
- backend bota tworzy automatycznie `./data/opinions.json` i trzyma atomowy zapis.

---

## Finalny backend opinii (Node.js ESM + Express + Discord.js)
Poniższy kod spełnia wymagania end-to-end:
- auto-tworzy `./data` i `./data/opinions.json`,
- `loadOpinions()` zawsze zwraca `{ items: [] }`,
- endpoint `GET /api/opinions` zawsze zwraca JSON `{ ok: true, items: [...] }`,
- zapis jest atomowy (`tmp` + `rename`),
- zachowuje zapis po modalu, log na Discord i refresh panelu.

```js
import { Events, MessageFlags } from "discord.js";
import express from "express";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve("./data");
const OPINIONS_FILE = path.join(DATA_DIR, "opinions.json");

function ensureOpinionsStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(OPINIONS_FILE)) {
    fs.writeFileSync(OPINIONS_FILE, JSON.stringify({ items: [] }, null, 2), "utf-8");
    return;
  }

  // jeśli plik pusty/uszkodzony -> napraw
  try {
    const raw = fs.readFileSync(OPINIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      fs.writeFileSync(OPINIONS_FILE, JSON.stringify({ items: [] }, null, 2), "utf-8");
    }
  } catch {
    fs.writeFileSync(OPINIONS_FILE, JSON.stringify({ items: [] }, null, 2), "utf-8");
  }
}

function loadOpinions() {
  ensureOpinionsStorage();
  try {
    const raw = fs.readFileSync(OPINIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return { items: parsed.items };
  } catch {
    return { items: [] };
  }
}

function saveOpinionsAtomically(payload) {
  ensureOpinionsStorage();
  const normalized = {
    items: Array.isArray(payload?.items) ? payload.items : []
  };

  const tmpPath = `${OPINIONS_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), "utf-8");
  fs.renameSync(tmpPath, OPINIONS_FILE);
}

function appendOpinion(opinion) {
  const db = loadOpinions();
  db.items.unshift(opinion);
  db.items = db.items.slice(0, 300);
  saveOpinionsAtomically(db);
}

export function startOpinionsApi(port = 3001) {
  const app = express();

  app.get("/api/opinions", (_req, res) => {
    const db = loadOpinions();
    return res.json({ ok: true, items: db.items.slice(0, 30) });
  });

  app.listen(port, () => {
    console.log(`Opinions API listening on :${port}`);
  });
}

// --- fragment z Twojego flow modala ---
async function handleOpinionSubmit(interaction, rating, atmosfera, przebieg, text, refreshOpinionPanel) {
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

  // zachowane: odpowiedź do usera
  await interaction.reply({
    content: `Dzięki! Zapisane: ${rating}/5 ⭐`,
    flags: MessageFlags.Ephemeral
  });

  // zachowane: log na kanał Discord (tu zostawiasz swoją obecną logikę logChannel.send)

  // zachowane: odświeżenie panelu
  await refreshOpinionPanel(interaction.client);
}

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    ensureOpinionsStorage();
    // tutaj zostaje Twoja logika startowa panelu
    console.log("Opinions storage ready");
  }
};
```

---

## Finalny fragment frontendu (strona)
Frontend powinien czytać dokładnie ten endpoint i format:

```js
const API_OPINIONS = "/api/opinions";

async function refreshOpinions() {
  const res = await fetch(API_OPINIONS, { cache: "no-store" });
  const contentType = res.headers.get("content-type") || "";
  const out = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : { ok: false, error: "Endpoint opinii zwrócił niepoprawny format (oczekiwano JSON)." };

  if (!res.ok || !out.ok || !Array.isArray(out.items)) {
    throw new Error(out.error || "Nie udało się pobrać opinii.");
  }

  return out.items;
}
```

## Kontakt i anty-spam
- cooldown: 45s między wiadomościami,
- max 5 wiadomości / 10 minut,
- przy limicie backend zwraca `429` i `retry_after_sec`.
