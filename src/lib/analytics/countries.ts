// ISO-3166-1 alpha-2 -> human name lookup, plus a flag-emoji helper.
//
// We intentionally keep the name table small (top countries by traffic
// the dashboard is likely to surface). For unrecognised codes we fall
// back to the code itself so the UI never shows nothing.

const NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  PL: "Poland",
  PT: "Portugal",
  CZ: "Czechia",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  NP: "Nepal",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  IL: "Israel",
  TR: "Türkiye",
  EG: "Egypt",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  MA: "Morocco",
  TN: "Tunisia",
  SG: "Singapore",
  MY: "Malaysia",
  ID: "Indonesia",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  HK: "Hong Kong",
  TW: "Taiwan",
  KR: "South Korea",
  JP: "Japan",
  CN: "China",
  NZ: "New Zealand",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  RU: "Russia",
  UA: "Ukraine",
  RO: "Romania",
  HU: "Hungary",
  GR: "Greece",
  BG: "Bulgaria",
};

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  const k = code.toUpperCase();
  return NAMES[k] ?? k;
}

/**
 * Convert an ISO-3166-1 alpha-2 code into its flag emoji by mapping the
 * two ASCII letters to their regional indicator symbols.
 *
 * Returns the globe emoji for missing/invalid codes so the UI never has
 * an empty cell.
 */
export function countryFlag(code: string | null | undefined): string {
  if (!code) return "🌐";
  const k = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(k)) return "🌐";
  const A = 0x41;
  const BASE = 0x1f1e6; // regional indicator symbol letter A
  const cp1 = BASE + (k.charCodeAt(0) - A);
  const cp2 = BASE + (k.charCodeAt(1) - A);
  return String.fromCodePoint(cp1, cp2);
}
