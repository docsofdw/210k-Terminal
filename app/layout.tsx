import { TooltipProvider } from "@/components/ui/tooltip"
import { TailwindIndicator } from "@/components/utility/tailwind-indicator"
import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
})

export const metadata: Metadata = {
  title: "210k Terminal",
  description: "Fund analytics for 210k Capital",
  metadataBase: new URL("https://terminal.utxomanagement.com"),
  openGraph: {
    title: "210k Terminal",
    description: "Fund analytics for 210k Capital",
    type: "website",
    siteName: "210k Terminal",
    images: [
      {
        url: "/logos/terminal-og-image.png",
        width: 1200,
        height: 630,
        alt: "210k Fund Terminal"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "210k Terminal",
    description: "Fund analytics for 210k Capital",
    images: ["/logos/terminal-og-image.png"]
  },
  icons: {
    icon: "/logos/utxo-logo-og.png",
    apple: "/logos/utxo-logo-og.png"
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
            <TooltipProvider>
              {children}

              <TailwindIndicator />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
