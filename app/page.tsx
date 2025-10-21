'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated, getCurrentUser, clearSession } from "../lib/auth"
import { LogOut, User } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const [isAuth, setIsAuth] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    // Check authentication status
    const authStatus = isAuthenticated()
    setIsAuth(authStatus)
    if (authStatus) {
      setCurrentUser(getCurrentUser())
    }
    setIsLoading(false)
  }, [])

  const handleLogout = () => {
    clearSession()
    setIsAuth(false)
    setCurrentUser(null)
    // Optionally redirect to login or refresh the page
    router.push('/login')
  }

  if (isLoading) {
    return (
      <main className="h-screen w-full grid grid-cols-1 md:grid-cols-2 px-10 items-center justify-center bg-background">
        <div className="flex flex-col items-start justify-center">
          <h1 className="text-[5rem] md:text-[10rem] mb-0 sara-brand font-semibold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent w-full text-center md:text-start">SARA</h1>
          <p className="text-sm md:text-xl text-muted-foreground mb-8 max-w-2xl text-center md:text-start sara-brand">
          Turn questions into stunning dashboards – visualize, analyze, and share insights in seconds.
          </p>
        </div>
        <div className="flex gap-10 flex-col justify-end">
          <div className="px-6 py-3 w-full bg-gray-200 text-black rounded-lg text-lg shadow animate-pulse">
            Loading...
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen w-full grid grid-cols-1 md:grid-cols-2 px-10 items-center justify-center bg-background">
              <div className="flex flex-col items-start justify-center">
          <h1 className="text-[5rem] md:text-[10rem] mb-0 sara-brand font-bold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent w-full text-center md:text-start">SARA</h1>
          <p className="text-sm md:text-3xl text-muted-foreground mb-8 max-w-2xl text-center md:text-center sara-brand">
          ASK . ANALYZE . VISUALIZE
          </p>
        </div>
      <div className="flex gap-6 flex-col justify-end">
        {isAuth ? (
          // Authenticated user section
          <>
            {/* User Info Section */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-muted">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <User className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Welcome back, {currentUser?.username}!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    User ID: {currentUser?.id}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-col">
              <Link href="/dashboard?edit=true">
                <button className="px-6 py-3 w-full bg-gradient-to-r from-green-800 to-green-500 text-white rounded-lg text-lg shadow hover:bg-blue-700 transition">Generate Queries</button>
              </Link>
              <Link href="/dashboard">
                <button className="px-6 py-3 w-full bg-gray-200 text-black rounded-lg text-lg shadow hover:bg-black hover:text-green-500 hover:border-green-500 border-2 border-black transition">View Saved Dashboards</button>
              </Link>
            </div>
          </>
        ) : (
          // Unauthenticated user buttons
          <div className="flex gap-4 flex-col">
            <Link href="/login">
              <button className="px-6 py-3 w-full bg-gradient-to-r from-green-800 to-green-500 text-white rounded-lg text-lg shadow hover:bg-blue-700 transition">Login</button>
            </Link>
            <Link href="/login">
              <button className="px-6 py-3 w-full bg-gray-200 text-black rounded-lg text-lg shadow hover:bg-black hover:text-green-500 hover:border-green-500 border-2 border-black transition">Register</button>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
