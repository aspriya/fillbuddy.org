// Augments the Wrangler-generated CloudflareEnv interface with bindings
// that come from `wrangler secret put` (which `wrangler types` does not
// emit because secret values are not declared in wrangler.jsonc).
//
// Keep this file source-of-truth for any secret that the application
// reads from `env.*` so the type system stays honest.

interface CloudflareEnv {
  /**
   * Shared admin password for `/admin/analytics`.
   *
   * Production: set with `npx wrangler secret put ANALYTICS_ADMIN_TOKEN`.
   * Local dev:  set in `.env.local` (see `.env.local.example`).
   *
   * Optional in the type because at runtime the dashboard renders a
   * "not configured" message when this is missing, instead of throwing.
   */
  ANALYTICS_ADMIN_TOKEN?: string;
}
