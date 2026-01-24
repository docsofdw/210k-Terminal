"use client"

import { SignIn } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { motion } from "framer-motion"
import { BarChart3, Bell, Bitcoin, Building2 } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"

export default function LoginPage() {
  const { theme } = useTheme()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        {/* Left side - Benefits */}
        <motion.div
          className="hidden space-y-8 lg:block"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-4">
            <motion.div
              className="inline-block"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <span className="bg-orange-500/10 text-orange-500 rounded-full px-3 py-1 text-xs font-medium">
                Welcome back
              </span>
            </motion.div>
            <motion.h1
              className="text-4xl font-bold tracking-tight lg:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              210k
              <motion.span
                className="from-orange-500 to-yellow-500 mt-2 block bg-gradient-to-r bg-clip-text text-transparent"
              >
                Terminal
              </motion.span>
            </motion.h1>
            <motion.p
              className="text-muted-foreground text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Access your treasury analytics and portfolio tracking.
            </motion.p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                icon: Building2,
                title: "Comps Table",
                desc: "15+ companies",
                color: "text-orange-500",
                bgColor: "bg-orange-500/10"
              },
              {
                icon: Bitcoin,
                title: "Live BTC Price",
                desc: "Real-time data",
                color: "text-orange-500",
                bgColor: "bg-orange-500/10"
              },
              {
                icon: BarChart3,
                title: "Analytics",
                desc: "mNAV & metrics",
                color: "text-orange-500",
                bgColor: "bg-orange-500/10"
              },
              {
                icon: Bell,
                title: "Alerts",
                desc: "Price notifications",
                color: "text-orange-500",
                bgColor: "bg-orange-500/10"
              }
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                className="bg-card group relative overflow-hidden rounded-lg border p-4 transition-all hover:shadow-lg"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 10px 20px rgba(0,0,0,0.1)"
                }}
              >
                <motion.div
                  className={`${feature.bgColor} mb-2 inline-flex rounded-lg p-2`}
                  initial={{ rotate: -10 }}
                  animate={{ rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: 0.4 + i * 0.1
                  }}
                  whileHover={{ rotate: 10 }}
                >
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </motion.div>
                <p className="text-sm font-semibold">{feature.title}</p>
                <p className="text-muted-foreground text-xs">{feature.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Stats */}
          <motion.div
            className="bg-muted/30 space-y-4 rounded-xl border p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">15+</p>
                <p className="text-muted-foreground text-sm">
                  Companies tracked
                </p>
              </div>
              <div className="border-muted h-12 w-px border-l" />
              <div>
                <p className="text-2xl font-bold">24/7</p>
                <p className="text-muted-foreground text-sm">
                  Real-time updates
                </p>
              </div>
              <div className="border-muted h-12 w-px border-l" />
              <div>
                <p className="text-2xl font-bold">10+</p>
                <p className="text-muted-foreground text-sm">Key metrics</p>
              </div>
            </div>
          </motion.div>

          {/* Platform badge */}
          <motion.div
            className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          >
            <Bitcoin className="h-5 w-5 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">210k Terminal</p>
              <p className="text-muted-foreground text-xs">
                Bitcoin treasury analytics
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Right side - Sign in form */}
        <motion.div
          className="mx-auto w-full max-w-md lg:mx-0"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div
            className="mb-8 text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="mb-2 text-2xl font-semibold">
              Sign in to your account
            </h2>
            <p className="text-muted-foreground text-sm">
              Don't have an account?{" "}
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="inline-block"
              >
                <Link
                  href="/signup"
                  className="text-primary font-medium transition-colors hover:underline"
                >
                  Request access
                </Link>
              </motion.span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <SignIn
              forceRedirectUrl="/dashboard"
              signUpUrl="/signup"
              appearance={{ baseTheme: theme === "dark" ? dark : undefined }}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
