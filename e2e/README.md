# E2E smoke tests

Three Playwright specs that boot the built app and click through the
critical paths. They run in CI on every PR (see `.github/workflows/ci.yml`)
against a throwaway Postgres, with no secrets — external services (Stripe,
Google Calendar) are mocked at the network layer.

## Running locally

The app's Neon driver speaks HTTP, so a proxy translates it to a local Postgres:

```sh
docker network create e2e-net
docker run -d --name e2e-pg --network e2e-net \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=main postgres:17
docker run -d --name e2e-neon-proxy --network e2e-net -p 4444:4444 \
  -e PG_CONNECTION_STRING=postgres://postgres:postgres@e2e-pg:5432/main \
  ghcr.io/timowilhelm/local-neon-http-proxy:main

# One-time: the proxy's mock control plane needs this table
docker exec e2e-pg psql -U postgres -d main -c "
  CREATE SCHEMA IF NOT EXISTS neon_control_plane;
  CREATE TABLE IF NOT EXISTS neon_control_plane.endpoints (
    endpoint_id VARCHAR(255) PRIMARY KEY, allowed_ips VARCHAR(255));"
```

Then:

```sh
export DATABASE_URL='postgres://postgres:postgres@db.localtest.me:5432/main'
export NEON_HTTP_PROXY_URL='http://localhost:4444/sql'
npm run schema && npm run seed && npm run build
npx playwright install chromium
npm run test:e2e
```

The booking-window and admin-password env vars the server needs are set in
`playwright.config.ts` (`webServer.env`), so no further setup is required.
