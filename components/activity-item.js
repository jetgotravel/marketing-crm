import { formatRelative } from "../lib/format";

const TYPE_STYLES = {
  contact_created: "bg-emerald-100 text-emerald-700",
  email_sent: "bg-blue-100 text-blue-700",
  email_opened: "bg-sky-100 text-sky-700",
  email_clicked: "bg-indigo-100 text-indigo-700",
  email_replied: "bg-green-100 text-green-700",
  email_bounced: "bg-red-100 text-red-700",
  enriched: "bg-purple-100 text-purple-700",
  status_changed: "bg-amber-100 text-amber-700",
  note_added: "bg-slate-100 text-slate-700",
  deal_created: "bg-emerald-100 text-emerald-700",
  deal_stage_changed: "bg-amber-100 text-amber-700",
  sequence_enrolled: "bg-violet-100 text-violet-700",
  sequence_completed: "bg-green-100 text-green-700",
  company_created: "bg-teal-100 text-teal-700",
};

function formatType(type) {
  return (type || "unknown").replace(/_/g, " ");
}

export default function ActivityItem({ activity }) {
  const typeClasses =
    TYPE_STYLES[activity.activity_type] || "bg-slate-100 text-slate-700";

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="shrink-0 mt-0.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeClasses}`}
        >
          {formatType(activity.activity_type)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900">
          {activity.description || formatType(activity.activity_type)}
        </p>
        {activity.contact_name && (
          <p className="text-xs text-slate-500 mt-0.5">
            {activity.contact_name}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-400 whitespace-nowrap shrink-0">
        {formatRelative(activity.created_at)}
      </p>
    </div>
  );
}

export { TYPE_STYLES, formatType };
