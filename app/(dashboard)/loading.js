import { SkeletonCard } from "../../components/loading";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mt-2" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Pipeline skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse shrink-0" />
            <div className="flex-1 h-5 bg-slate-100 rounded-full animate-pulse" />
            <div className="h-4 w-16 bg-slate-200 rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>

      {/* Activity skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-2">
            <div className="h-5 w-20 bg-slate-200 rounded animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="h-3 w-12 bg-slate-200 rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
