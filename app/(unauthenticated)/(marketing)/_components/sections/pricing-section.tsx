"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Check, Shield, TrendingUp } from "lucide-react"
import Link from "next/link"
import { SectionWrapper } from "./section-wrapper"

const features = [
  "Real-time Bitcoin treasury tracking",
  "Comparative analysis (mNAV, EV/BTC NAV)",
  "Portfolio management",
  "Historical charts and data",
  "Price alerts (Telegram/Slack)",
  "Admin audit logging"
]

export function PricingSection() {
  return (
    <SectionWrapper id="pricing">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <motion.h2
            className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Internal Platform Access
          </motion.h2>
          <motion.p
            className="text-muted-foreground mt-4 text-lg leading-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            210k Terminal is available to authorized team members.
          </motion.p>
        </div>

        <div className="mx-auto mt-16 max-w-lg">
          <motion.div
            className="bg-card text-card-foreground ring-border relative rounded-3xl p-8 ring-1"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-4">
              <TrendingUp className="text-primary h-8 w-8" />
              <h3 className="text-foreground text-lg leading-8 font-semibold">
                Team Access
              </h3>
            </div>

            <p className="text-muted-foreground mt-4 text-sm leading-6">
              Full access to treasury intelligence features for authorized 210k
              Capital team members.
            </p>

            <ul className="text-muted-foreground mt-8 space-y-3 text-sm leading-6">
              {features.map(feature => (
                <li key={feature} className="flex gap-x-3">
                  <Check
                    className="text-primary h-6 w-5 flex-none"
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>

            <Button className="mt-8 w-full" asChild>
              <Link href="/login">
                <Shield className="mr-2 h-4 w-4" />
                Sign in to access
              </Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-muted-foreground text-sm">
            Contact an administrator if you need access to the platform.
          </p>
        </motion.div>
      </div>
    </SectionWrapper>
  )
}
