import { getCustomerByUserId } from "@/actions/customers"
import { SelectCustomer } from "@/db/schema/customers"
import { currentUser } from "@clerk/nextjs/server"
import { Header } from "./header"

export async function HeaderWrapper() {
  const user = await currentUser()
  let role: SelectCustomer["role"] | null = null

  if (user) {
    const customer = await getCustomerByUserId(user.id)
    role = customer?.role ?? "viewer"
  }

  return <Header userRole={role} />
}
