'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, ArrowLeft, Mail, Phone, Building, User } from 'lucide-react'

interface ContactFormProps {
  onBack: () => void
}

export function ContactForm({ onBack }: ContactFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSubmitStatus('idle')

    try {
      // Simulate API call - replace with actual endpoint
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // For demo purposes, always succeed
      setSubmitStatus('success')
      
      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          company: '',
          message: ''
        })
        setSubmitStatus('idle')
      }, 3000)
      
    } catch (err) {
      setSubmitStatus('error')
      setError('Failed to send message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-2xl py-6">
      {/* Header */}
      <div className="text-start flex flex-row items-center gap-6 border-b border-white/30 justify-start mb-6">
        <h1 className="text-[3rem] font-bold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent sara-brand">
          SARA
        </h1>
        <p className="text-lg text-white/70 font-light sara-brand">
          Simple Automated <br /> Reporting Assistant
        </p>
      </div>

      {/* Contact Form */}
      <Card className="bg-white/5  overflow-y-auto border-white/10 backdrop-blur-xl max-h-[calc(100vh-300px)] flex flex-col">
      

        <CardHeader className="text-start items-start flex flex-col gap-1 pt-4 pb-4 px-0 pl-1 border-b border-white/30 mb-4">
        
            <CardTitle className="text-2xl pl-4 font-bold ">
            <span className="  bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">Tell us your needs</span> <br /> <span className="text-white/70">and our team will help you get started</span>
          </CardTitle>
          {/* <CardDescription className="text-white/70 text-base">
            Tell us about your needs and we&apos;ll help you get started
          </CardDescription> */}
        </CardHeader>
        
        <CardContent className="px-4 pb-4 flex-1 ">
          {submitStatus === 'success' ? (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-500/20 rounded-full">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Thank You!</h3>
              <p className="text-white/70 text-base">
                We&apos;ve received your message and will get back to you within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="firstName" className="text-sm font-medium text-white/80 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    First Name
                  </label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Enter first name"
                    required
                    disabled={isSubmitting}
                    className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm h-10"
                  />
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="lastName" className="text-sm font-medium text-white/80 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Last Name
                  </label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Enter last name"
                    required
                    disabled={isSubmitting}
                    className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm h-10"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-white/80 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email Address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email address"
                  required
                  disabled={isSubmitting}
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm h-10"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label htmlFor="phone" className="text-sm font-medium text-white/80 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Phone Number
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  disabled={isSubmitting}
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm h-10"
                />
              </div>

              {/* Company */}
              <div className="space-y-1">
                <label htmlFor="company" className="text-sm font-medium text-white/80 flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  Company/Organization
                </label>
                <Input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Enter company name"
                  disabled={isSubmitting}
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm h-10"
                />
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label htmlFor="message" className="text-sm font-medium text-white/80">
                  Tell us about your needs
                </label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Describe your reporting needs, data sources, or any specific requirements..."
                  required
                  disabled={isSubmitting}
                  rows={3}
                  className="bg-white/5 border-white/10 focus:border-green-500/50 focus:ring-green-500/30 placeholder:text-white/30 text-white text-sm resize-none"
                />
              </div>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button 
                type="submit"
                className="w-full bg-gradient-to-r from-green-400 to-emerald-600 hover:from-green-500 hover:to-emerald-700 text-white font-medium text-base py-3"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </Button>
            </form>
          )}
        </CardContent>
        <div className="px-4 pb-4 border-t border-white/10 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="hover:bg-white/10 text-white/80 hover:text-white w-auto text-sm"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Go Back
          </Button>
        </div>
      </Card>

      {/* Additional Info */}
      <div className="mt-4 mb-6 text-center">
        <p className="text-white/60 text-xs">
          By submitting this form, you agree to our privacy policy and terms of service.
        </p>
      </div>
      
    </div>

  )
}
