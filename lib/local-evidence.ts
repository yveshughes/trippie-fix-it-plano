// Private field photos are available only through the local development server.
export function canReadLocalEvidence(request: Request) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const allowed = ["127.0.0.1:3015", "localhost:3015"];
  return Boolean(host && allowed.includes(host) && (!origin || allowed.some(h => origin === `http://${h}`)) && (!site || site === "same-origin" || site === "none"));
}
