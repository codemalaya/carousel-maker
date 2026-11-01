import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder with the same grid as the editor, shown until the first project doc arrives. */
export function WorkspaceSkeleton({ leftW = 280, rightW = 300 }: { leftW?: number; rightW?: number }) {
  return (
    <div className="app" style={{ gridTemplateColumns: `${leftW}px 1fr ${rightW}px` }} aria-busy="true">
      <div className="col-span-3 flex items-center gap-3 border-b px-4">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-6 h-7 w-56 rounded-full" />
        <Skeleton className="ml-auto h-7 w-24" />
      </div>
      <div className="flex flex-col gap-3 border-r p-3">
        <Skeleton className="h-9 w-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full" />
        ))}
      </div>
      <main className="flex items-center justify-center p-10">
        <Skeleton className="aspect-[4/5] h-full max-h-[80%]" />
      </main>
      <div className="flex flex-col gap-4 border-l p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
