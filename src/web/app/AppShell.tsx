import { useState, type ReactNode } from "react";
import { CalendarDays, GalleryHorizontalEnd, LayoutGrid, Palette, PanelLeftClose, PanelLeftOpen, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanAlerts } from "@/pages/planner/planStore";

export type Page = "home" | "plan" | "brands" | "trash";

const NAV: { page: Page; label: string; icon: LucideIcon }[] = [
  { page: "home", label: "Project", icon: LayoutGrid },
  { page: "plan", label: "Rencana konten", icon: CalendarDays },
  { page: "brands", label: "Brand kit", icon: Palette },
  { page: "trash", label: "Sampah", icon: Trash2 },
];

const KEY = "carousel-sidebar";

/** Frame for the pages that are not the editor (project list, planner, brands, trash): navigation on the left, the page on the right. */
export function AppShell({ page, onNav, children }: { page: Page; onNav: (p: Page) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === "1");
  const alerts = usePlanAlerts();
  const badge = alerts.overdue + alerts.today;
  const toggle = () => {
    localStorage.setItem(KEY, collapsed ? "0" : "1");
    setCollapsed(!collapsed);
  };
  return (
    <div className="flex h-screen w-full">
      <nav aria-label="Navigasi utama" className={cn("bg-card flex shrink-0 flex-col border-r transition-[width]", collapsed ? "w-14" : "w-56")}>
        <button type="button" onClick={() => onNav("home")} aria-label="Semua project" className={cn("flex h-14 shrink-0 items-center gap-2 border-b px-3.5 text-left", collapsed && "justify-center px-0")}>
          <span className="bg-brand grid size-6 shrink-0 place-items-center rounded-md text-white">
            <GalleryHorizontalEnd className="size-3.5" />
          </span>
          {!collapsed && <strong className="truncate text-sm">Carousel Maker</strong>}
        </button>
        <ul className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map(({ page: p, label, icon: Icon }) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => onNav(p)}
                title={collapsed ? label : undefined}
                aria-label={p === "plan" && badge > 0 ? `${label}: ${alerts.overdue} terlewat, ${alerts.today} hari ini` : label}
                aria-current={page === p ? "page" : undefined}
                className={cn(
                  "hover:bg-accent flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                  page === p ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-4 shrink-0" />
                  {p === "plan" && badge > 0 && collapsed && <span className={cn("absolute -top-1 -right-1 size-2 rounded-full", alerts.overdue ? "bg-red-500" : "bg-brand")} aria-hidden />}
                </span>
                {!collapsed && <span className="truncate">{label}</span>}
                {!collapsed && p === "plan" && badge > 0 && (
                  <span className={cn("ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-medium text-white tabular-nums", alerts.overdue ? "bg-red-500" : "bg-brand")}>{badge}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t p-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            className={cn("text-muted-foreground hover:bg-accent hover:text-foreground flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm", collapsed && "justify-center px-0")}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && <span>Ciutkan</span>}
          </button>
        </div>
      </nav>
      <main className="block h-screen min-w-0 flex-1">{children}</main>
    </div>
  );
}
