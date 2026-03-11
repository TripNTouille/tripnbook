import * as React from "react"
import { siteConfig } from "@/config/site"
import { CheckCircle, XCircle } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type SessionData = {
  customerEmail: string
  amountTotal: number
  metadata: {
    roomName: string
    adultsCount: string
    childrenCount: string
    from: string
    to: string
    nightCount: string
    phone: string
    specialNeeds: string
  }
}

type CheckoutResult =
  | { status: "success"; session: SessionData }
  | { status: "cancelled" }

export default function CheckoutResultDialog() {
  const [result, setResult] = React.useState<CheckoutResult | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get("checkout")

    if (!checkout) return

    // Clean up URL immediately so a refresh won't re-trigger the dialog
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, "", cleanUrl)

    const sessionId = params.get("session_id")
    if (!sessionId) return

    if (checkout === "cancelled") {
      setResult({ status: "cancelled" })
      return
    }

    if (checkout === "success") {
      fetch(`/api/checkout/session?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.paymentStatus === "paid") {
            setResult({ status: "success", session: data })
          }
        })
    }
  }, [])

  if (!result) return null

  if (result.status === "cancelled") {
    return (
      <Dialog open onOpenChange={() => setResult(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-muted-foreground" />
              Réservation annulée
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le paiement a été annulé. Votre réservation n&apos;a pas été enregistrée.
            Vous pouvez réessayer à tout moment.
          </p>
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const { session } = result
  const meta = session.metadata
  const totalGuests = Number(meta.adultsCount) + Number(meta.childrenCount)
  const nightCount = Number(meta.nightCount)

  return (
    <Dialog open onOpenChange={() => setResult(null)}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600" />
            Réservation confirmée !
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Merci pour votre réservation. Un email de confirmation a été envoyé
          à <span className="font-medium">{session.customerEmail}</span>.
        </p>

        <div className="rounded-md border p-4 text-sm flex flex-col gap-1">
          <p>
            <span className="font-medium">Chambre :</span> {meta.roomName}
          </p>
          <p>
            <span className="font-medium">Voyageurs :</span>{" "}
            {totalGuests} {totalGuests > 1 ? "personnes" : "personne"}
            {" "}({meta.adultsCount} {Number(meta.adultsCount) > 1 ? "adultes" : "adulte"}
            {Number(meta.childrenCount) > 0 &&
              `, ${meta.childrenCount} ${Number(meta.childrenCount) > 1 ? "enfants" : "enfant"}`})
          </p>
          <p>
            <span className="font-medium">Séjour :</span>{" "}
            du {meta.from} au {meta.to} ({nightCount}{" "}
            {nightCount > 1 ? "nuits" : "nuit"})
          </p>
          <p>
            <span className="font-medium">Prix :</span>{" "}
            {(session.amountTotal / 100).toFixed(0)} €
          </p>
          <p className="mt-1 italic text-muted-foreground">Petit-déjeuner inclus</p>
        </div>

        <p className="text-sm text-muted-foreground">
          Questions ? Contactez-nous à{" "}
          <a href={`mailto:${siteConfig.contactEmail}`} className="underline font-medium">
            {siteConfig.contactEmail}
          </a>{" "}
          ou au{" "}
          <a href={`tel:${siteConfig.contactPhone.href}`} className="underline font-medium">
            {siteConfig.contactPhone.display}
          </a>.
        </p>

        <DialogFooter>
          <Button onClick={() => setResult(null)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}