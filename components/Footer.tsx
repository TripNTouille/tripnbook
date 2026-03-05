import { MailIcon, PhoneIcon, MapPinIcon } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function Footer() {
  return (
    <footer className="bg-black text-white mt-12 py-10 px-6">
      <div className="flex justify-center mb-8">
        <Image
          src="/logo.png"
          width={80}
          height={88}
          alt="Trip'n Touille"
        />
      </div>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8 md:gap-16 justify-center">
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg mb-1">Contact</h3>
          <Link
            href="mailto:contact@tripntouille.com"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <MailIcon className="size-4" />
            contact@tripntouille.com
          </Link>
          <Link
            href="tel:+33630438587"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <PhoneIcon className="size-4" />
            +33 6 30 43 85 87
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg mb-1">Adresse</h3>
          <div className="flex items-start gap-2 text-sm">
            <MapPinIcon className="size-4 mt-0.5 shrink-0" />
            <address className="not-italic leading-relaxed">
              859 route de Plainchassagne<br />
              lieu-dit Plainchassagne<br />
              Vendenesse-les-Charolles, 71120<br />
              France
            </address>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg mb-1">Suivez-nous</h3>
          <Link
            href="https://www.facebook.com/tripntouille"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
          >
            Facebook
          </Link>
          <Link
            href="https://www.instagram.com/tripntouille"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
          >
            Instagram
          </Link>
        </div>
      </div>
    </footer>
  )
}