"use client"

import {
  BarChart3,
  Bell,
  Building2,
  History,
  Home,
  LayoutDashboard,
  Settings2,
  Star,
  TrendingUp,
  Users,
  Wallet
} from "lucide-react"
import * as React from "react"
import Link from "next/link"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar"
import { NavMain } from "../_components/nav-main"
import { NavUser } from "../_components/nav-user"
import { TeamSwitcher } from "../_components/team-switcher"

export function AppSidebar({
  userData,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userData: {
    name: string
    email: string
    avatar: string
    role: string
  }
}) {
  const isAdmin = userData.role === "admin"

  const data = {
    user: userData,
    teams: [
      {
        name: "210k Terminal",
        logo: TrendingUp,
        plan: "Treasury Analytics"
      }
    ],
    navMain: [
      {
        title: "Markets",
        url: "#",
        icon: LayoutDashboard,
        items: [
          {
            title: "Comps Table",
            url: "/dashboard/comps"
          }
        ]
      },
      {
        title: "Portfolio",
        url: "#",
        icon: Wallet,
        items: [
          {
            title: "Positions",
            url: "/dashboard/portfolio"
          }
        ]
      },
      {
        title: "Analytics",
        url: "#",
        icon: BarChart3,
        items: [
          {
            title: "Charts",
            url: "/dashboard/charts"
          },
          {
            title: "History",
            url: "/dashboard/history"
          }
        ]
      },
      {
        title: "Alerts",
        url: "#",
        icon: Bell,
        items: [
          {
            title: "Manage",
            url: "/dashboard/alerts"
          },
          {
            title: "History",
            url: "/dashboard/alerts/history"
          }
        ]
      },
      ...(isAdmin
        ? [
            {
              title: "Admin",
              url: "#",
              icon: Settings2,
              items: [
                {
                  title: "Companies",
                  url: "/dashboard/admin/companies"
                },
                {
                  title: "Users",
                  url: "/dashboard/admin/users"
                },
                {
                  title: "Audit Log",
                  url: "/dashboard/admin/audit"
                }
              ]
            }
          ]
        : [])
    ]
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2 pt-2">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Home">
              <Link href="/dashboard">
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
