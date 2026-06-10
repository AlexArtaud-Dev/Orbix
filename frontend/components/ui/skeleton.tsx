import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** 3 placeholder list-item cards — drop-in replacement for "Chargement…" on list pages */
function SkeletonListItems({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border px-4 py-4 flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-52" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for form/detail pages — stacked card blocks */
function SkeletonForm({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {Array.from({ length: blocks }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonListItems, SkeletonForm };
