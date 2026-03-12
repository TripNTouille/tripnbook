"use client"

import React, { createContext, useContext, useState } from "react"

type SessionIdContextType = string

const SessionIdContext = createContext<SessionIdContextType>("")

function initializeSessionId(): string {
  if (typeof window === "undefined") return ""

  const baseUrl = window.location.origin
  const stored = localStorage.getItem(baseUrl)

  if (stored) {
    return stored
  } else {
    const newSessionId = crypto.randomUUID()
    localStorage.setItem(baseUrl, newSessionId)
    return newSessionId
  }
}

export function SessionIdProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState(() => initializeSessionId())

  return (
    <SessionIdContext.Provider value={sessionId}>
      {children}
    </SessionIdContext.Provider>
  )
}

export function useSessionId(): string {
  const sessionId = useContext(SessionIdContext)
  return sessionId
}
