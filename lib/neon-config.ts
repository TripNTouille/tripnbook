import { neonConfig } from "@neondatabase/serverless"

// In CI, route the Neon HTTP driver to a local proxy backed by a plain
// Postgres container (no Neon cloud, no secrets). Unset in dev/production.
if (process.env.NEON_HTTP_PROXY_URL) {
  neonConfig.fetchEndpoint = process.env.NEON_HTTP_PROXY_URL
}
