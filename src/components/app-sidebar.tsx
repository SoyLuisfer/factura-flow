import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Upload, ScrollText, Scale, Building2, FlaskConical } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Tablero", url: "/", icon: LayoutDashboard },
  { title: "Subir factura", url: "/subir", icon: Upload },
  { title: "Registro de auditoría", url: "/auditoria", icon: ScrollText },
  { title: "Reglas", url: "/reglas", icon: Scale },
  { title: "Proveedores", url: "/proveedores", icon: Building2 },
  { title: "Banco de pruebas", url: "/banco-pruebas", icon: FlaskConical },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-mono text-sm font-bold text-sidebar-primary-foreground">C</div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Contralor</div>
              <div className="text-xs text-sidebar-foreground/60">Andes Labs LLC</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Cuentas por pagar</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
