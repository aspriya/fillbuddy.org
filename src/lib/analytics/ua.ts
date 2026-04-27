import type {
  BROWSER_VALUES,
  DEVICE_VALUES,
  OS_VALUES,
} from "./schema";

// Minimal categorical User-Agent classifier.
//
// We deliberately do NOT capture the raw User-Agent string — only the
// coarse {device, browser, os} bucket, because:
// - The raw UA is high-entropy enough to be considered a fingerprinting
//   signal in some jurisdictions.
// - The buckets are all we use in the dashboard.
//
// Heuristics are intentionally simple. If a browser doesn't match cleanly
// it falls into 'other'.

type Device = (typeof DEVICE_VALUES)[number];
type Browser = (typeof BROWSER_VALUES)[number];
type Os = (typeof OS_VALUES)[number];

export interface UaCategorisation {
  device: Device;
  browser: Browser;
  os: Os;
}

export function categoriseUserAgent(ua: string | null | undefined): UaCategorisation {
  const s = (ua ?? "").toString();
  return {
    device: classifyDevice(s),
    browser: classifyBrowser(s),
    os: classifyOs(s),
  };
}

function classifyDevice(s: string): Device {
  // Tablets first (iPad reports as "Mobile" on some iOS versions).
  if (/iPad/i.test(s)) return "tablet";
  if (/Tablet/i.test(s)) return "tablet";
  // Android phones include "Mobile"; Android tablets typically don't.
  if (/Android/i.test(s) && !/Mobile/i.test(s)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(s)) return "mobile";
  if (s.length === 0) return "other";
  return "desktop";
}

function classifyBrowser(s: string): Browser {
  // Order matters: Edge UA contains "Chrome", Chrome UA contains "Safari".
  if (/Edg\//.test(s) || /EdgA?\//.test(s)) return "edge";
  if (/Firefox\//.test(s) || /FxiOS\//.test(s)) return "firefox";
  if (/Chrome\//.test(s) || /CriOS\//.test(s)) return "chrome";
  if (/Safari\//.test(s)) return "safari";
  return "other";
}

function classifyOs(s: string): Os {
  // iOS check before Mac (older iPads identify as Mac).
  if (/iPhone|iPad|iPod|iOS/i.test(s)) return "ios";
  if (/Android/i.test(s)) return "android";
  if (/Windows/i.test(s)) return "windows";
  if (/Mac OS X|Macintosh/i.test(s)) return "macos";
  if (/Linux|X11/i.test(s)) return "linux";
  return "other";
}

// re-export types so consumers don't need to peek into schema.ts
export type { Device, Browser, Os };
