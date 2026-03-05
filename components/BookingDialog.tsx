import * as React from "react"
import { format, differenceInDays } from "date-fns"
import { fr } from "date-fns/locale"
import { Info } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type BookingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomName: string
  adultsCount: number
  childrenCount: number
  from: Date
  to: Date
}

export default function BookingDialog({
  open,
  onOpenChange,
  roomName,
  adultsCount,
  childrenCount,
  from,
  to,
}: BookingDialogProps) {
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [specialNeeds, setSpecialNeeds] = React.useState("")

  const nightCount = differenceInDays(to, from)
  const totalGuests = adultsCount + childrenCount

  const pricePerNight = nightCount === 1 ? 80 : 75
  const extraGuests = Math.max(0, totalGuests - 2)
  const totalPrice = (pricePerNight + extraGuests * 20) * nightCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Confirmer la réservation</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Booking summary */}
          <div className="rounded-md border p-4 text-sm flex flex-col gap-1">
            <p><span className="font-medium">Chambre :</span> {roomName}</p>
            <p>
              <span className="font-medium">Voyageurs :</span>{" "}
              {totalGuests} {totalGuests > 1 ? "personnes" : "personne"}
              {" "}({adultsCount} {adultsCount > 1 ? "adultes" : "adulte"}
              {childrenCount > 0 && `, ${childrenCount} ${childrenCount > 1 ? "enfants" : "enfant"}`})
            </p>
            <p>
              <span className="font-medium">Séjour :</span>{" "}
              du {format(from, "d MMM yyyy", { locale: fr })} au{" "}
              {format(to, "d MMM yyyy", { locale: fr })} ({nightCount}{" "}
              {nightCount > 1 ? "nuits" : "nuit"})
            </p>
            <p className="flex items-center gap-1">
              <span className="font-medium">Prix :</span>{" "}
              {totalPrice} €
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="list-disc pl-3">
                      <li>{pricePerNight} €/nuit (1-2 pers.)</li>
                      {extraGuests > 0 && <li>{extraGuests} pers. suppl. × 20 €/nuit</li>}
                      <li>{nightCount} {nightCount > 1 ? "nuits" : "nuit"}</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
            <p className="mt-1 italic text-muted-foreground">Petit-déjeuner inclus</p>
          </div>

          {/* Contact fields */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="special-needs">Demandes particulières</Label>
              <Textarea
                id="special-needs"
                placeholder="Allergies, heure d'arrivée, lit bébé..."
                value={specialNeeds}
                onChange={(e) => setSpecialNeeds(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={!email.trim() || !phone.trim()}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}