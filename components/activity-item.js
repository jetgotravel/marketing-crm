import { formatRelative } from "../lib/format";

export default function ActivityItem({ activity }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-slate-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900">{activity.description}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {activity.type} &middot; {formatRelative(activity.created_at)}
        </p>
      </div>
    </div>
  );
}
