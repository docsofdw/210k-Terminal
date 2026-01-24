import { type InsertCustomer } from "../../schema/customers"

// get this from your 1st user in clerk (dev mode)
export const userId = "user_2y8Cx5ekKHYstsIdBVAj2ZYB6EV"

export const customersData: InsertCustomer[] = [
  {
    userId,
    name: "Admin User",
    email: "admin@210kcapital.com",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date()
  }
]
