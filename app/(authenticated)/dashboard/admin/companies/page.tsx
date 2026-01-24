import { getAllCompanies } from "@/actions/companies"
import { getCustomerByUserId } from "@/actions/customers"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { auth } from "@clerk/nextjs/server"
import { Building2, Shield } from "lucide-react"
import { redirect } from "next/navigation"

export default async function AdminCompaniesPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/login")
  }

  const customer = await getCustomerByUserId(userId)

  if (!customer || customer.role !== "admin") {
    redirect("/dashboard")
  }

  const companies = await getAllCompanies()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          Manage Companies
        </h1>
        <p className="text-muted-foreground">
          Add, edit, and manage treasury companies
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead className="text-right">BTC Holdings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map(company => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.ticker}</Badge>
                    </TableCell>
                    <TableCell>{company.exchange}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(company.btcHoldings || 0).toLocaleString()} BTC
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={company.status === "active" ? "default" : "secondary"}
                      >
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.updatedAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Full editing functionality will be added in Phase 4.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
