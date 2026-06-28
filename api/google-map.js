const BRANCH_MAPS = {
  strizkov: {
    query: "Autoškola BuBu, U Kapliček 34, Praha 8 Střížkov, Czechia",
    fallback: "https://www.google.com/maps/search/?api=1&query=Auto%C5%A1kola%20BuBu%20U%20Kapli%C4%8Dek%2034%20Praha%208%20St%C5%99%C3%AD%C5%BEkov",
  },
  kladno: {
    query: "Autoškola BuBu, Cyrila Boudy 2954, Kladno, Czechia",
    fallback: "https://www.google.com/maps/search/?api=1&query=Auto%C5%A1kola%20BuBu%20Cyrila%20Boudy%202954%20Kladno",
  },
  statenice: {
    query: "Autoškola BuBu, Statenická 23, Statenice, Czechia",
    fallback: "https://www.google.com/maps/search/?api=1&query=Auto%C5%A1kola%20BuBu%20Statenick%C3%A1%2023%20Statenice",
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const branch = String(req.query.branch || "").toLowerCase();
  const map = BRANCH_MAPS[branch];
  if (!map) {
    res.status(404).send("Unknown branch");
    return;
  }

  const key = process.env.GOOGLE_MAPS_EMBED_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!doctype html><html lang="cs"><body style="margin:0;font-family:system-ui,sans-serif;background:#eef8f7;color:#1f3772;display:grid;place-items:center;min-height:100vh;text-align:center"><main><strong>Mapa není nakonfigurovaná.</strong><br><a href="${map.fallback}" target="_blank" rel="noopener">Otevřít v Google Maps</a></main></body></html>`);
    return;
  }

  const url = new URL("https://www.google.com/maps/embed/v1/place");
  url.searchParams.set("key", key);
  url.searchParams.set("q", map.query);
  url.searchParams.set("zoom", "16");
  url.searchParams.set("language", "cs");
  url.searchParams.set("region", "CZ");

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.redirect(302, url.toString());
}
