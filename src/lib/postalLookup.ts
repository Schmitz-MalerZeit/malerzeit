/**
 * Resolves a German postal code to a city name.
 *
 * Strategy (in order):
 *   1. user's own past-customer history (instant, offline)
 *   2. sessionStorage cache (avoid repeat API calls in the same session)
 *   3. OpenPLZ API – official Bund data, covers ALL German postal codes,
 *      free, no key required. https://www.openplzapi.org/
 *   4. Zippopotam.us as last-resort fallback (older, less complete coverage)
 *
 * Returns null only if no source knows the code.
 */
export async function lookupCityForPostalCode(
  plz: string,
  history: { postal_code: string; city: string }[]
): Promise<string | null> {
  const code = (plz || "").trim();
  if (!/^\d{5}$/.test(code)) return null;

  // 1) own history
  const fromHistory = history.find(
    (h) => (h.postal_code || "").trim() === code && (h.city || "").trim().length > 0
  );
  if (fromHistory) return fromHistory.city.trim();

  // 2) sessionStorage cache
  const cacheKey = `plz:${code}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch { /* ignore */ }

  const cache = (city: string) => {
    try { sessionStorage.setItem(cacheKey, city); } catch { /* ignore */ }
    return city;
  };

  // 3) OpenPLZ API – authoritative, complete German PLZ coverage
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://openplzapi.org/de/Localities?postalCode=${encodeURIComponent(code)}`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } }
    );
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Prefer the "biggest"/canonical entry – API returns one entry per
        // locality. For a 1-to-1 PLZ this is unambiguous; for a shared PLZ
        // we take the first (alphabetically/officially listed) entry, which
        // matches what the post office uses as primary city.
        const city: string | undefined = data[0]?.name;
        if (city) return cache(city);
      }
    }
  } catch { /* ignore – fall through to Zippopotam */ }

  // 4) Zippopotam.us fallback
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://api.zippopotam.us/de/${code}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const city: string | undefined = data?.places?.[0]?.["place name"];
    if (city) return cache(city);
  } catch { /* ignore */ }

  return null;
}
