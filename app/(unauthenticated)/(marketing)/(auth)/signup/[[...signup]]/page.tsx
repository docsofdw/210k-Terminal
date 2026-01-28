"use client"

import { SignUp } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"
import Image from "next/image"
import Link from "next/link"

export default function SignUpPage() {
  const { theme } = useTheme()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center">
        {/* Logo */}
        <Image
          src="/logos/utxo-logo-og.png"
          alt="UTXO Logo"
          width={64}
          height={64}
          className="mb-4"
        />

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight">
          210k <span className="text-terminal-orange">Terminal</span>
        </h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          Create your account
        </p>

        {/* Clerk Sign Up */}
        <SignUp
          forceRedirectUrl="/dashboard"
          signInUrl="/login"
          appearance={{ baseTheme: theme === "dark" ? dark : undefined }}
        />

        {/* Sign in link */}
        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-terminal-orange hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
