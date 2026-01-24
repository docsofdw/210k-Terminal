"use server"

import { db } from "@/db"
import { customers, type SelectCustomer } from "@/db/schema/customers"
import { eq } from "drizzle-orm"

export async function getCustomerByUserId(
  userId: string
): Promise<SelectCustomer | null> {
  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, userId)
  })

  return customer || null
}

export async function createCustomer(
  userId: string,
  name?: string,
  email?: string
): Promise<{ isSuccess: boolean; data?: SelectCustomer }> {
  try {
    const [newCustomer] = await db
      .insert(customers)
      .values({
        userId,
        name,
        email,
        role: "viewer"
      })
      .returning()

    if (!newCustomer) {
      return { isSuccess: false }
    }

    return { isSuccess: true, data: newCustomer }
  } catch (error) {
    console.error("Error creating customer:", error)
    return { isSuccess: false }
  }
}

export async function updateCustomerByUserId(
  userId: string,
  updates: Partial<SelectCustomer>
): Promise<{ isSuccess: boolean; data?: SelectCustomer }> {
  try {
    const [updatedCustomer] = await db
      .update(customers)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(customers.userId, userId))
      .returning()

    if (!updatedCustomer) {
      return { isSuccess: false }
    }

    return { isSuccess: true, data: updatedCustomer }
  } catch (error) {
    console.error("Error updating customer by userId:", error)
    return { isSuccess: false }
  }
}

export async function getAllCustomers(): Promise<SelectCustomer[]> {
  const allCustomers = await db.query.customers.findMany({
    orderBy: (customers, { asc }) => [asc(customers.createdAt)]
  })

  return allCustomers
}

export async function setCustomerRole(
  userId: string,
  role: "admin" | "viewer"
): Promise<{ isSuccess: boolean; data?: SelectCustomer }> {
  return updateCustomerByUserId(userId, { role })
}
