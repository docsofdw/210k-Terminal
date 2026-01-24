import { Bitcoin, TrendingUp } from "lucide-react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-muted/50" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <span className="text-lg font-bold">210k Terminal</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="#features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="#faq" className="hover:text-foreground">
              FAQ
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bitcoin className="h-4 w-4 text-orange-500" />
            <span>210k Terminal</span>
          </div>
        </div>
        <div className="border-border mt-8 border-t pt-8 text-center">
          <p className="text-muted-foreground text-xs leading-5">
            &copy; {new Date().getFullYear()} 210k Terminal
          </p>
        </div>
      </div>
    </footer>
  )
}
