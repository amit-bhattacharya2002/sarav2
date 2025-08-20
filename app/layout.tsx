import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"

// Configure Inter font with robust fallback options
const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap', // Use swap to prevent layout shift
  fallback: ['system-ui', 'arial', 'sans-serif'], // Multiple fallback fonts
  preload: true,
  adjustFontFallback: true,
  // Add timeout and retry options
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: "SARA",
  description: "A tool to assemble sample bar graphs into a dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground font-sans antialiased`}>
        <ThemeProvider defaultTheme="dark" attribute="class">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
