import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

class SentryExampleBackendError extends Error {
  constructor() {
    super("This error is raised on the backend of the admin Sentry test.")
    this.name = "SentryExampleBackendError"
  }
}

export async function POST() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  throw new SentryExampleBackendError()
}
