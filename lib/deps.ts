import Stripe from "stripe"
import { Resend } from "resend"
import { checkDatesAvailability, createHoldEvent, confirmHoldEvent, deleteHoldEvent } from "@/lib/calendar"
import { sendBookingConfirmation } from "@/lib/email"
import type { CalendarDeps, EmailDeps } from "@/lib/checkout"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

export const calendar: CalendarDeps = {
  checkDatesAvailability,
  createHoldEvent,
  confirmHoldEvent,
  deleteHoldEvent,
}

const resend = new Resend(process.env.RESEND_API_KEY!)

export const email: EmailDeps = {
  sendConfirmation: (data) => sendBookingConfirmation(resend, data),
}