/**
 * Resolves a German postal code to a city name.
 * Strategy: 1) check user's own history (passed in), 2) fallback to public Zippopotam.us API.
 * Returns null if nothing found. Caches API results in sessionStorage to avoid repeat calls.
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
    if (cached) return cached || null;
  } catch { /* ignore */ }

  // 3) Zippopotam.us (free, no key, supports DE)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://api.zippopotam.us/de/${code}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const city: string | undefined = data?.places?.[0]?.["place name"];
    if (city) {
      try { sessionStorage.setItem(cacheKey, city); } catch { /* ignore */ }
      return city;
    }
  } catch { /* ignore */ }

  return null;
}
