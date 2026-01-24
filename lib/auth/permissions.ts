import { auth } from "@clerk/nextjs/server"
import { getCustomerByUserId } from "@/actions/customers"
import { redirect } from "next/navigation"

export type UserRole = "admin" | "viewer"

export interface CurrentUser {
  userId: string
  email: string | null
  name: string | null
  role: UserRole
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth()

  if (!userId) {
    return null
  }

  const customer = await getCustomerByUserId(userId)

  if (!customer) {
    return null
  }

  return {
    userId,
    email: customer.email,
    name: customer.name,
    role: customer.role
  }
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth()

  if (user.role !== "admin") {
    redirect("/dashboard")
  }

  return user
}

export function canEdit(user: CurrentUser | null): boolean {
  return user?.role === "admin"
}

export function canView(user: CurrentUser | null): boolean {
  return user !== null
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin"
}
