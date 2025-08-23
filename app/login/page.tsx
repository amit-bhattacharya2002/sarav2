'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authenticateUser, createSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, ChevronDown, ChevronUp, ArrowLeft, Database, BarChart3, Share2, Zap, Shield, Users } from 'lucide-react'

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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background">
      {/* Left Column - Login Form */}
      <div className="flex items-center w-full justify-center px-10  bg-black/40 h-full">
        <Card className="w-full h-auto my-auto py-10  backdrop-blur-xl ">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="ml-12 hover:bg-white/10 text-white/80 hover:text-white mb-2 w-8 h-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          <CardHeader className="text-start space-y-2 pb-6 pt-12 px-12">
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
              LOGIN
            </CardTitle>
            
          </CardHeader>
          <CardContent className="px-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="username" className="text-base font-medium text-white/80">
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
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-lg h-12"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-base font-medium text-white/80">
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
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-lg h-12"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="text-base">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit"
                className="w-full bg-gradient-to-r from-green-400 to-emerald-600 hover:from-green-500 hover:to-emerald-700 text-white font-medium text-lg py-6"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => setShowDemoUsers(!showDemoUsers)}
                className="w-full flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
              >
                <span className="text-lg font-medium text-white/90">Demo Users</span>
                {showDemoUsers ? (
                  <ChevronUp className="h-5 w-5 text-white/70" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-white/70" />
                )}
              </button>
              
              {showDemoUsers && (
                <div className="mt-3 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="grid grid-cols-2 gap-3 text-base text-white/60">
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
      

      {/* Right Column - Features Highlights */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-black">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-start flex flex-row items-center gap-10 border-b border-white/30  justify-start mb-12">
            <h1 className="text-[5rem] font-bold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent sara-brand">
              SARA
            </h1>
            <p className="text-xl text-white/70 font-light sara-brand">
              Simple Automated <br /> Reporting Assistant
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="group p-6 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                  <Database className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Smart SQL Generation</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Generate complex SQL queries with natural language input
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                  <BarChart3 className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Interactive Dashboards</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Create beautiful, interactive charts and visualizations
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                  <Zap className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Real-time Analytics</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Get instant insights with live data processing
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group p-6 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                  <Share2 className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Easy Sharing</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Share dashboards and reports with your team
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group p-6 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                  <Shield className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Secure & Reliable</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Enterprise-grade security with data protection
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group p-6 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                  <Users className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Team Collaboration</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Work together with shared workspaces and permissions
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-12">
            <div className="inline-flex items-center space-x-2 px-6 py-3 bg-green-500/20 rounded-full border border-green-500/30">
              <Zap className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-medium">Ready to get started?</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
