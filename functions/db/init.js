export async function onRequestGet() {
  return json({
    ok: false,
    error: "Inicjalizacja bazy opini jest wyłączona (system opini usunięty)."
  }, 410);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
