const COOKIE_NAME = "wc_dc_session";
const OAUTH_STATE_COOKIE_NAME = "wc_dc_oauth_state";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 dni
const OAUTH_STATE_TTL_SEC = 60 * 10; // 10 minut

export async function createSessionCookie(user, env) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id || ""),
    username: String(user.username || ""),
    global_name: String(user.global_name || ""),
    discriminator: String(user.discriminator || ""),
    avatar: String(user.avatar || ""),
    iat: now,
    exp: now + SESSION_TTL_SEC
  };

  const encoded = base64url(JSON.stringify(payload));
  const sig = await hmac(encoded, env.SESSION_SECRET || "");
  const value = `${encoded}.${sig}`;

  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function readSessionUser(request, env) {
  const cookies = parseCookieHeader(request.headers.get("Cookie") || "");
  const raw = cookies[COOKIE_NAME];
  if (!raw || !raw.includes(".")) return null;

  const [encoded, sig] = raw.split(".");
  const expected = await hmac(encoded, env.SESSION_SECRET || "");
  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.sub || !payload?.exp || now > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createOauthStateCookie(nonce, env) {
  const payload = {
    nonce: String(nonce || ""),
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SEC
  };
  const encoded = base64url(JSON.stringify(payload));
  const sig = await hmac(encoded, env.SESSION_SECRET || "");
  return `${OAUTH_STATE_COOKIE_NAME}=${encoded}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${OAUTH_STATE_TTL_SEC}`;
}

export async function readOauthStateCookie(request, env) {
  const cookies = parseCookieHeader(request.headers.get("Cookie") || "");
  const raw = cookies[OAUTH_STATE_COOKIE_NAME];
  if (!raw || !raw.includes(".")) return null;

  const [encoded, sig] = raw.split(".");
  const expected = await hmac(encoded, env.SESSION_SECRET || "");
  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    if (!payload?.nonce || !payload?.exp) return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearOauthStateCookie() {
  return `${OAUTH_STATE_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function randomNonce(size = 16) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64url(bytes);
}

export function parseCookieHeader(str) {
  const out = {};
  for (const part of str.split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const key = part.slice(0, i).trim();
    const val = part.slice(i + 1).trim();
    out[key] = val;
  }
  return out;
}

export function base64url(input) {
  const b64 = btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64urlDecode(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return decodeURIComponent(escape(atob(b64)));
}

async function hmac(input, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return bytesToBase64url(new Uint8Array(sig));
}

function bytesToBase64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
