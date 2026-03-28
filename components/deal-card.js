import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCurrency, formatDate } from "../lib/format";

export default function DealCard({ deal }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg shadow-sm p-3 cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 shadow-md" : ""
      }`}
    >
      <p className="text-sm font-medium text-slate-900 truncate">
        {deal.deal_name}
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
      {deal.expected_close_date && (
        <p className="text-xs text-slate-400 mt-0.5">
          Close: {formatDate(deal.expected_close_date)}
        </p>
      )}
    </div>
  );
}
