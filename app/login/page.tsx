'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authenticateUser, createSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDemoUsers, setShowDemoUsers] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const user = authenticateUser(username, password)
      
      if (user) {
        createSession(user)
        router.push('/dashboard?edit=true')
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      setError('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent">
            SARA Login
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your dashboards and queries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowDemoUsers(!showDemoUsers)}
              className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
            >
              <span className="text-sm font-semibold">Demo Users</span>
              {showDemoUsers ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            
            {showDemoUsers && (
              <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div>user142 / 2533</div>
                  <div>user523 / 9313</div>
                  <div>user622 / 1231</div>
                  <div>user789 / 4567</div>
                  <div>user234 / 8901</div>
                  <div>user567 / 2345</div>
                  <div>user890 / 6789</div>
                  <div>user123 / 0123</div>
                  <div>user456 / 3456</div>
                  <div>user999 / 9999</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
