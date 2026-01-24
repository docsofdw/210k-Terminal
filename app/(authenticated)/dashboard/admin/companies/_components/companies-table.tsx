"use client"

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
import { Edit, ExternalLink } from "lucide-react"
import { useState } from "react"
import { CompanyEditDialog } from "./company-edit-dialog"

interface CompaniesTableProps {
  companies: SelectCompany[]
}

export function CompaniesTable({ companies }: CompaniesTableProps) {
  const [editingCompany, setEditingCompany] = useState<SelectCompany | null>(null)

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead>Exchange</TableHead>
              <TableHead className="text-right">BTC Holdings</TableHead>
              <TableHead className="text-right">Shares Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tracked</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map(company => (
              <TableRow key={company.id}>
                <TableCell>
                  <div className="font-medium">{company.name}</div>
                  <div className="text-xs text-muted-foreground">{company.country}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{company.ticker}</Badge>
                </TableCell>
                <TableCell>{company.exchange}</TableCell>
                <TableCell className="text-right font-mono">
                  {Number(company.btcHoldings || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {company.sharesOutstanding
                    ? (Number(company.sharesOutstanding) / 1e6).toFixed(1) + "M"
                    : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={company.status === "active" ? "default" : "secondary"}>
                    {company.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={company.isTracked ? "default" : "outline"}>
                    {company.isTracked ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {company.updatedAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingCompany(company)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingCompany && (
        <CompanyEditDialog
          company={editingCompany}
          open={!!editingCompany}
          onOpenChange={open => !open && setEditingCompany(null)}
        />
      )}
    </>
  )
}
