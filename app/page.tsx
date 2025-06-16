import Dashboard from "@/components/dashboard"
import { Suspense } from "react"

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background">
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <Dashboard />
      </Suspense>
    </main>
  )
}
