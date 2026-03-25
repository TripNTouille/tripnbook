import Footer from "@/components/Footer"
import { SessionIdProvider } from "@/components/SessionIdProvider"

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionIdProvider>
      {children}
      <Footer />
    </SessionIdProvider>
  )
}