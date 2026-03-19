import { formatCurrency } from "../lib/format";

export default function DealCard({ deal }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-3 cursor-grab active:cursor-grabbing">
      <p className="text-sm font-medium text-slate-900 truncate">
        {deal.name}
      </p>
      {deal.value != null && (
        <p className="text-sm text-slate-600 mt-1">
          {formatCurrency(deal.value)}
        </p>
      )}
      {deal.contact_name && (
        <p className="text-xs text-slate-400 mt-1 truncate">
          {deal.contact_name}
        </p>
      )}
    </div>
  );
}
