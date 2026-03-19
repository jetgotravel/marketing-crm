export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
    </div>
  );
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-3">
      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
    </div>
  );
}
