import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center">
        {/* Logo */}
        <Image
          src="/logos/utxo-logo-og.png"
          alt="UTXO Logo"
          width={80}
          height={80}
          className="mb-6"
        />

        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          210k{" "}
          <span className="text-terminal-orange">Terminal</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-muted-foreground">
          Fund analytics for 210k Capital
        </p>

        {/* Login Button */}
        <Button asChild size="lg" className="mt-8">
          <Link href="/login">
            Sign In
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </main>
  )
}
