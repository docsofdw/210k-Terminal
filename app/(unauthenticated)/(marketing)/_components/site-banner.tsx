"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Bitcoin, X } from "lucide-react"
import { useState } from "react"

export function SiteBanner() {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          transition={{ duration: 0.2 }}
          className="bg-orange-500 text-white relative"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative flex items-center justify-center py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center text-sm font-semibold">
                  <Bitcoin className="mr-2 h-4 w-4" />
                  210k Terminal
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="absolute right-0 rounded p-1 transition-colors hover:bg-white/10"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
