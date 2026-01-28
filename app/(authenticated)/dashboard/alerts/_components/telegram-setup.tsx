"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { connectTelegram } from "@/actions/user"
import { useRouter } from "next/navigation"

interface TelegramSetupProps {
  isConnected: boolean
  telegramUsername?: string | null
}

const BOT_USERNAME = "terminal210k_bot"
const BOT_URL = `https://t.me/${BOT_USERNAME}`

export function TelegramSetup({ isConnected, telegramUsername }: TelegramSetupProps) {
  const router = useRouter()
  const [chatId, setChatId] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleConnect() {
    if (!chatId.trim()) {
      toast.error("Please enter your Chat ID")
      return
    }

    setIsLoading(true)

    try {
      const result = await connectTelegram(chatId.trim())

      if (result.isSuccess) {
        toast.success("Telegram connected successfully!")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to connect")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  function copyBotLink() {
    navigator.clipboard.writeText(BOT_URL)
    toast.success("Bot link copied!")
  }

  if (isConnected) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            Telegram Connected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {telegramUsername ? (
              <>Alerts will be sent to <span className="font-mono text-foreground">@{telegramUsername}</span></>
            ) : (
              "You'll receive alerts via Telegram"
            )}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-[#0088cc]" />
          Connect Telegram
        </CardTitle>
        <CardDescription>
          Get instant alerts on your phone
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1 - Open Bot */}
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Open bot & send /start</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" asChild className="bg-[#0088cc] hover:bg-[#0088cc]/90">
                <a href={BOT_URL} target="_blank" rel="noopener noreferrer">
                  Open Bot
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
              <Button size="sm" variant="outline" onClick={copyBotLink}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2 - Paste Chat ID */}
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            2
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Paste your Chat ID</p>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="e.g., 1262476386"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="font-mono h-9"
              />
              <Button onClick={handleConnect} disabled={isLoading || !chatId.trim()} size="sm">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
