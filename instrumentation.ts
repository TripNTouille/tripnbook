import { registerOTel } from "@vercel/otel"
import * as Sentry from "@sentry/nextjs"

export async function register() {
  registerOTel({ serviceName: "tripnbook" })

  // Sentry's server/edge configs are not loaded automatically: without these
  // imports the server SDK never initializes and SSR errors go unreported.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
