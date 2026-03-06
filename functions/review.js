export async function onRequestPost() {
  return json({
    ok: false,
    error: "System opini został wyłączony na stronie."
  }, 410);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
