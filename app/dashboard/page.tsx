import Dashboard from "@/components/dashboard"
import { Suspense } from "react"
import { AuthGuard } from '@/components/auth-guard'

export default function DashboardPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen w-full bg-background">
        <Suspense fallback={<div>Loading dashboard...</div>}>
          <Dashboard />
        </Suspense>
      </main>
    </AuthGuard>
  )
} 