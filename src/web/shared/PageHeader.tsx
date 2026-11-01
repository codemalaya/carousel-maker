import type { ReactNode } from "react";

/** Top bar of the pages inside AppShell: page title on the left, page actions on the right. Left aligned like the page content. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="h-14 shrink-0 !px-0">
      <div className="flex w-full items-center justify-between px-8">
        <span className="truncate text-sm font-medium">{title}</span>
        <div className="flex items-center gap-1">{children}</div>
      </div>
    </header>
  );
}
