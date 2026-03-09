import { Resend } from "resend"

const OWNER_EMAIL = "contact@tripntouille.com"

export type BookingConfirmationData = {
  guestEmail: string
  guestName: string
  roomName: string
  adultsCount: number
  childrenCount: number
  from: string
  to: string
  nightCount: number
  totalPrice: number
}

/**
 * Sends a booking confirmation to the guest, with the owner address in BCC
 * so they get a copy of every confirmed booking.
 */
export async function sendBookingConfirmation(
  resend: Resend,
  data: BookingConfirmationData,
): Promise<void> {
  const { guestEmail, guestName, roomName, adultsCount, childrenCount, from, to, nightCount, totalPrice } = data

  const totalGuests = adultsCount + childrenCount
  const guestLabel = totalGuests > 1 ? `${totalGuests} personnes` : "1 personne"
  const childrenLabel = childrenCount > 0
    ? ` (${adultsCount} ${adultsCount > 1 ? "adultes" : "adulte"}, ${childrenCount} ${childrenCount > 1 ? "enfants" : "enfant"})`
    : ` (${adultsCount} ${adultsCount > 1 ? "adultes" : "adulte"})`
  const nightLabel = nightCount > 1 ? `${nightCount} nuits` : "1 nuit"

  await resend.emails.send({
    from: `Trip'n Touille <${OWNER_EMAIL}>`,
    to: guestEmail,
    bcc: OWNER_EMAIL,
    subject: `Confirmation de votre réservation — ${roomName}`,
    html: buildEmailHtml({ guestName, roomName, guestLabel, childrenLabel, from, to, nightLabel, totalPrice }),
  })
}

type TemplateData = {
  guestName: string
  roomName: string
  guestLabel: string
  childrenLabel: string
  from: string
  to: string
  nightLabel: string
  totalPrice: number
}

function buildEmailHtml(d: TemplateData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmation de réservation</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:Georgia,serif;color:#1c1917;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">

          <!-- Header -->
          <tr>
            <td style="background:#1c1917;padding:32px 40px;">
              <p style="margin:0;font-size:22px;color:#ffffff;letter-spacing:0.03em;">Trip&rsquo;n Touille</p>
              <p style="margin:8px 0 0;font-size:13px;color:#a8a29e;letter-spacing:0.05em;text-transform:uppercase;">Chambres d&rsquo;hôtes</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
                Bonjour ${d.guestName},
              </p>
              <p style="margin:0 0 32px;font-size:16px;line-height:1.6;">
                Votre réservation est confirmée. Nous avons hâte de vous accueillir&nbsp;!
              </p>

              <!-- Booking recap -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:6px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 16px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#78716c;">Récapitulatif</p>
                    ${row("Chambre", d.roomName)}
                    ${row("Voyageurs", d.guestLabel + d.childrenLabel)}
                    ${row("Arrivée", d.from)}
                    ${row("Départ", d.to)}
                    ${row("Durée", d.nightLabel)}
                    ${row("Prix total", `${d.totalPrice}&nbsp;€`, true)}
                    <p style="margin:12px 0 0;font-size:13px;color:#78716c;font-style:italic;">Petit-déjeuner inclus</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">
                Une question ? Contactez-nous&nbsp;:
              </p>
              <p style="margin:0;font-size:15px;line-height:1.8;">
                <a href="mailto:${OWNER_EMAIL}" style="color:#1c1917;">${OWNER_EMAIL}</a><br />
                <a href="tel:+33630438587" style="color:#1c1917;">+33 6 30 43 85 87</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e7e5e4;">
              <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.6;">
                Trip&rsquo;n Touille &mdash; Chambres d&rsquo;hôtes<br />
                Cet email a été envoyé automatiquement suite à votre réservation.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Single labelled row in the recap table */
function row(label: string, value: string, highlight = false): string {
  const valueStyle = highlight
    ? "font-size:15px;font-weight:bold;color:#1c1917;"
    : "font-size:15px;color:#1c1917;"
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
      <tr>
        <td style="font-size:13px;color:#78716c;width:40%;">${label}</td>
        <td style="${valueStyle}">${value}</td>
      </tr>
    </table>`
}