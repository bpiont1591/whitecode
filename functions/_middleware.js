function shouldRedirectToCanonical(host, canonicalHost) {
  if (!host || !canonicalHost) return false;
  const normalizedHost = String(host).toLowerCase();
  const normalizedCanonical = String(canonicalHost).toLowerCase();

  if (normalizedHost === normalizedCanonical) return false;

  const knownHosts = new Set(["whitecode.pl", "www.whitecode.pl"]);
  return knownHosts.has(normalizedHost) && knownHosts.has(normalizedCanonical);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const canonicalHost = String(env.CANONICAL_HOST || "www.whitecode.pl").trim();

  if (shouldRedirectToCanonical(url.host, canonicalHost)) {
    url.host = canonicalHost;
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
