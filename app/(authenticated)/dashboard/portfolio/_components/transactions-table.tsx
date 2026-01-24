"use client"

import { deleteTransaction } from "@/actions/portfolio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { SelectCompany } from "@/db/schema/companies"
import type { SelectPortfolioTransaction } from "@/db/schema/portfolio-transactions"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface TransactionsTableProps {
  transactions: {
    transaction: SelectPortfolioTransaction
    company: SelectCompany
  }[]
}

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const result = await deleteTransaction(id)
      if (result.isSuccess) {
        toast.success("Transaction deleted")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to delete transaction")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setDeletingId(null)
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No transactions yet. Add a transaction to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-border/50">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Total (USD)</TableHead>
            <TableHead className="text-right">Total (BTC)</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map(({ transaction, company }) => {
            const shares = parseFloat(transaction.shares)
            const pricePerShare = parseFloat(transaction.pricePerShare)
            const totalValueUsd = transaction.totalValueUsd
              ? parseFloat(transaction.totalValueUsd)
              : parseFloat(transaction.totalValue)
            const totalValueBtc = transaction.totalValueBtc
              ? parseFloat(transaction.totalValueBtc)
              : 0

            return (
              <TableRow key={transaction.id}>
                <TableCell className="tabular-nums">
                  {new Date(transaction.transactionDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      transaction.type === "buy" ? "success" : "destructive"
                    }
                  >
                    {transaction.type.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{company.ticker}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {company.name}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {shares.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${pricePerShare.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${totalValueUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums text-terminal-orange">
                  {totalValueBtc > 0 ? totalValueBtc.toFixed(6) : "-"}
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-muted-foreground">
                  {transaction.notes || "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(transaction.id)}
                    disabled={deletingId === transaction.id}
                  >
                    {deletingId === transaction.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
