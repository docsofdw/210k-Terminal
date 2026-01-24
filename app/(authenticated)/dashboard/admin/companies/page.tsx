import { getAllCompaniesAdmin } from "@/actions/companies"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { CompaniesTable } from "./_components/companies-table"

export default async function AdminCompaniesPage() {
  const companies = await getAllCompaniesAdmin()

  const activeCount = companies.filter(c => c.status === "active").length
  const trackedCount = companies.filter(c => c.isTracked).length
  const totalBtc = companies.reduce((sum, c) => sum + Number(c.btcHoldings || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          Manage Companies
        </h1>
        <p className="text-muted-foreground">
          Add, edit, and manage treasury companies. All changes are logged.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Companies</CardDescription>
            <CardTitle className="text-2xl">{companies.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tracked</CardDescription>
            <CardTitle className="text-2xl">{trackedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total BTC</CardDescription>
            <CardTitle className="text-2xl">{totalBtc.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Companies</CardTitle>
          <CardDescription>
            Click edit to modify company data. Changes are audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompaniesTable companies={companies} />
        </CardContent>
      </Card>
    </div>
  )
}
