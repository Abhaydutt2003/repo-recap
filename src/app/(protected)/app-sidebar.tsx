"use client";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import {
  Bot,
  CreditCard,
  LayoutDashboard,
  Plus,
  Presentation,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Q&A",
    url: "/qa",
    icon: Bot,
  },
  {
    title: "Meetings",
    url: "/meetings",
    icon: Presentation,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { open } = useSidebar();
  const { projects, projectId, setProjectId } = useProject();
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Image
            src="/repo-recap-logo.svg"
            alt="logo"
            width={40}
            height={40}
          ></Image>
          {open && (
            <h1 className="text-primary/80 text-xl font-bold">Repo Recap</h1>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((singleItem, index) => {
                return (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={singleItem.url}
                        className={cn({
                          "!bg-primary !text-white":
                            pathname === singleItem.url,
                        })}
                      >
                        <singleItem.icon></singleItem.icon>
                        <span>{singleItem.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Your Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects?.map((singleProject) => {
                return (
                  <SidebarMenuItem key={singleProject.name}>
                    <SidebarMenuButton asChild>
                      <div onClick={() => setProjectId(singleProject.id)}>
                        <div
                          className={cn(
                            "text-primary flex size-6 items-center justify-center rounded-sm border bg-white text-sm",
                            {
                              "bg-primary text-white":
                                singleProject.id == projectId,
                            },
                          )}
                        >
                          {singleProject.name[0]}
                        </div>
                        <span>{singleProject.name}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <div className="h-2" />
              {open && (
                <SidebarMenuItem>
                  <Link href="/create">
                    <Button variant={"outline"} className="w-fit" size={"sm"}>
                      <Plus></Plus>
                      Create Project
                    </Button>
                  </Link>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
