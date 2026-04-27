import { z } from "zod";

// The wire format for POST /api/events.
// Pure module — safe to import from both browser (Phase B client) and
// the Worker route handler.
//
// Strict-by-design: any field not listed here is rejected. This is
// intentional, so that a future bug can never accidentally start
// transmitting PDF content, filenames, or other PII (see docs/analytics.md §2).

export const EVENT_TYPES = [
  "landing_view",
  "app_open",
  "pdf_upload",
  "fillbuddy_upload",
  "pdf_download",
  "fillbuddy_save",
] as const;

export const DEVICE_VALUES = ["desktop", "mobile", "tablet", "other"] as const;
export const BROWSER_VALUES = [
  "chrome",
  "firefox",
  "safari",
  "edge",
  "other",
] as const;
export const OS_VALUES = [
  "windows",
  "macos",
  "linux",
  "ios",
  "android",
  "other",
] as const;
export const FILE_SIZE_BUCKETS = [
  "<100KB",
  "100KB-1MB",
  "1-5MB",
  "5-20MB",
  ">20MB",
] as const;
export const ENGINE_MODES = ["direct", "overlay"] as const;

export const EventBody = z
  .object({
    id: z.string().uuid(),
    type: z.enum(EVENT_TYPES),
    visitorId: z.string().uuid().nullish(),
    sessionId: z.string().uuid().nullish(),
    device: z.enum(DEVICE_VALUES).nullish(),
    browser: z.enum(BROWSER_VALUES).nullish(),
    os: z.enum(OS_VALUES).nullish(),
    referrerHost: z.string().max(120).nullish(),
    engineMode: z.enum(ENGINE_MODES).nullish(),
    pageCount: z.number().int().nonnegative().max(10_000).nullish(),
    annotationCount: z.number().int().nonnegative().max(100_000).nullish(),
    fileSizeBucket: z.enum(FILE_SIZE_BUCKETS).nullish(),
    wasEncrypted: z.boolean().nullish(),
    durationMs: z.number().int().nonnegative().max(86_400_000).nullish(),
  })
  .strict();

export type EventBody = z.infer<typeof EventBody>;
export type EventType = (typeof EVENT_TYPES)[number];
