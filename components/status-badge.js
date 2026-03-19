const CONTACT_STATUS = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  replied: "bg-green-100 text-green-700",
  qualified: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
};

const DEAL_STAGE = {
  lead: "bg-slate-100 text-slate-700",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-amber-100 text-amber-700",
  negotiation: "bg-purple-100 text-purple-700",
  closed_won: "bg-emerald-100 text-emerald-700",
  closed_lost: "bg-red-100 text-red-700",
};

export default function StatusBadge({ value, type = "contact" }) {
  const map = type === "deal" ? DEAL_STAGE : CONTACT_STATUS;
  const classes = map[value] || "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}
    >
      {value?.replace(/_/g, " ")}
    </span>
  );
}
