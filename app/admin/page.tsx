import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import TestEmailForm from "./TestEmailForm"
import TestStripeForm from "./TestStripeForm"
import TestCalendarForm from "./TestCalendarForm"
import BookingLogsTable from "./BookingLogsTable"
import { siteConfig } from "@/config/site"

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect("/admin/login")

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <form action={async () => {
          "use server"
          await signOut({ redirectTo: "/admin/login" })
        }}>
          <button type="submit" className="text-sm text-gray-500 hover:text-black">
            Se déconnecter
          </button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <TestEmailForm fromEmail={siteConfig.contactEmail} />
        <TestStripeForm />
        <TestCalendarForm />
      </div>

      <div className="mt-8">
        <BookingLogsTable />
      </div>
    </main>
  )
}