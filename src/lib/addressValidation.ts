/**
 * Validates that a German street + postal code + city combination is
 * internally consistent according to the official OpenPLZ dataset.
 *
 * Used right before the AI quote step to prevent typos / stale entries
 * (e.g. user picked a suggestion, then manually changed PLZ to a wrong
 * one) from ending up on the customer-facing PDF.
 *
 * Returns:
 *   - { ok: true } – combination is valid (or could not be checked online,
 *     in which case we fail OPEN so the user is never blocked by network).
 *   - { ok: false, suggestion } – mismatch detected, with the canonical
 *     PLZ + city for the given street (best match) so the UI can offer a
 *     one-tap correction.
 */

export type AddressValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "plz_city_mismatch" | "street_not_in_plz";
      suggestion?: { postalCode: string; city: string };
    };

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Pulls just the street name out of "Musterstraße 12a". */
const stripHouseNumber = (input: string): string => {
  const m = (input || "").trim().match(/^(.*?)(?:\s+\d.*)?$/);
  return (m?.[1] || input || "").trim();
};

interface OpenPlzStreet {
  name?: string;
  postalCode?: string;
  locality?: string;
}

export async function validateGermanAddress(args: {
  street: string;
  postalCode: string;
  city: string;
}): Promise<AddressValidationResult> {
  const street = stripHouseNumber(args.street);
  const postalCode = (args.postalCode || "").trim();
  const city = (args.city || "").trim();

  // Basic shape – cannot validate without all three.
  if (!street || !/^\d{5}$/.test(postalCode) || !city) return { ok: true };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const url =
      `https://openplzapi.org/de/Streets?name=${encodeURIComponent(street)}` +
      `&postalCode=${encodeURIComponent(postalCode)}&page=1&pageSize=20`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) return { ok: true }; // fail open
    const data = (await res.json()) as OpenPlzStreet[];
    if (!Array.isArray(data) || data.length === 0) {
      // Street not found under this PLZ → look up correct PLZ for that street
      const fallback = await suggestCorrectPlz(street);
      return {
        ok: false,
        reason: "street_not_in_plz",
        suggestion: fallback,
      };
    }

    const nStreet = norm(street);
    const nCity = norm(city);

    // Find an exact (or street-prefix) match where the city also matches.
    const cityMatch = data.find(
      (r) => norm(r.locality || "") === nCity && norm(r.name || "").startsWith(nStreet),
    );
    if (cityMatch) return { ok: true };

    // Same PLZ + street exists, but city differs → suggest the canonical one.
    const streetMatch = data.find((r) => norm(r.name || "").startsWith(nStreet));
    if (streetMatch?.locality && streetMatch?.postalCode) {
      return {
        ok: false,
        reason: "plz_city_mismatch",
        suggestion: {
          postalCode: streetMatch.postalCode.trim(),
          city: streetMatch.locality.trim(),
        },
      };
    }

    // PLZ exists but street wasn't really found → look elsewhere.
    const fallback = await suggestCorrectPlz(street, city);
    return { ok: false, reason: "street_not_in_plz", suggestion: fallback };
  } catch {
    return { ok: true }; // network issue → never block the user
  }
}

async function suggestCorrectPlz(
  street: string,
  city?: string,
): Promise<{ postalCode: string; city: string } | undefined> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const url =
      `https://openplzapi.org/de/Streets?name=${encodeURIComponent(street)}` +
      `&page=1&pageSize=25`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) return undefined;
    const data = (await res.json()) as OpenPlzStreet[];
    if (!Array.isArray(data) || data.length === 0) return undefined;
    const nCity = norm(city || "");
    const preferred =
      (nCity && data.find((r) => norm(r.locality || "") === nCity)) || data[0];
    if (!preferred?.postalCode || !preferred?.locality) return undefined;
    return {
      postalCode: preferred.postalCode.trim(),
      city: preferred.locality.trim(),
    };
  } catch {
    return undefined;
  }
}
