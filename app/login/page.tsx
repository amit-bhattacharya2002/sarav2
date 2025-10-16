'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authenticateUser, createSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, ChevronDown, ChevronUp, ArrowLeft, Database, BarChart3, Share2, Zap, Shield, Users } from 'lucide-react'
import { ContactForm } from '@/components/contact-form'
import Image from 'next/image'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDemoUsers, setShowDemoUsers] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background lg:grid-rows-2">
      
      {/* Left Column - Login Form */}
      <div className="flex items-start w-full justify-center px-6 bg-black/40 min-h-screen py-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <Card className="w-full h-auto my-auto py-6 backdrop-blur-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="ml-8 hover:bg-white/10 text-white/80 hover:text-white mb-2 w-6 h-6"
            >
              <ArrowLeft className="h-3 w-3" />
            </Button>
          <CardHeader className="text-start space-y-1 pb-4 pt-6 px-8">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
              LOGIN
            </CardTitle>
            
          </CardHeader>
          <CardContent className="px-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="username" className="text-sm font-medium text-white/80">
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
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm h-10"
                />
              </div>
              
              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium text-white/80">
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
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm h-10"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit"
                className="w-full bg-gradient-to-r from-green-400 to-emerald-600 hover:from-green-500 hover:to-emerald-700 text-white font-medium text-base py-3"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowDemoUsers(!showDemoUsers)}
                className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
              >
                <span className="text-sm font-medium text-white/90">Demo Users</span>
                {showDemoUsers ? (
                  <ChevronUp className="h-4 w-4 text-white/70" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white/70" />
                )}
              </button>
              
              {showDemoUsers && (
                <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
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
      

      {/* Right Column - Features Highlights or Contact Form */}
      <div className="flex items-start justify-center p-6 lg:p-8 bg-black min-h-screen lg:overflow-y-auto">
        {showContactForm ? (
          <ContactForm onBack={() => setShowContactForm(false)} />
        ) : (
          <div className="w-full max-w-2xl py-6 my-auto">
            {/* Header */}
            <div className="text-start flex flex-row items-center gap-6 border-b border-white/30 justify-start mb-6">
              <h1 className="text-[3rem] font-bold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent sara-brand">
                SARA
              </h1>
              <p className="text-lg text-white/70 font-light sara-brand">
                Simple Automated <br /> Reporting Assistant
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Feature 1 */}
              <div className="group p-4 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                    <Database className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">Smart SQL Generation</h3>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Generate complex SQL queries with natural language input
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group p-4 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                    <BarChart3 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">Interactive Dashboards</h3>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Create beautiful, interactive charts and visualizations
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group p-4 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                    <Zap className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">Real-time Analytics</h3>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Get instant insights with live data processing
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="group p-4 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                    <Share2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">Easy Sharing</h3>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Share dashboards and reports with your team
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="group p-4 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                    <Shield className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">Secure & Reliable</h3>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Enterprise-grade security with data protection
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="group p-4 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:bg-white/10">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                    <Users className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">Team Collaboration</h3>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Work together with shared workspaces and permissions
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center mt-6 mb-6">
              <button
                onClick={() => setShowContactForm(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30 hover:bg-green-500/30 hover:border-green-500/50 transition-all duration-300 cursor-pointer"
              >
                <Zap className="h-3 w-3 text-green-400" />
                <span className="text-green-400 font-medium text-sm">Ready to get started?</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center justify-center py-6 px-6">
          <div className="flex items-center  space-x-3  text-white/60 hover:text-white/80 transition-colors">
            <span className="text-base">Presented by</span>
            <a 
              href="https://meaningfulinnovations.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-3 hover:text-green-300 transition-colors"
            >
              <Image src="/milogocropped.png" alt="Meaningful Innovations Logo" width={32} height={32} />
              {/* <span className="text-base text-blue-300 font-medium">Meaningful Innovations</span> */}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
