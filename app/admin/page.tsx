import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"

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
    </main>
  )
}