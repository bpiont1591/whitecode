function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequest() {
  return json({ ok: false, error: "Ręczna inicjalizacja wyłączona. Użyj SQL z README/db/opinions.sql." }, 410);
}
