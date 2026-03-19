import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import StatusBadge from "./status-badge";
import DealCard from "./deal-card";
import { formatCurrency } from "../lib/format";

export default function KanbanColumn({ stage, deals }) {
  const { setNodeRef } = useDroppable({ id: stage });

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="flex flex-col w-64 sm:w-72 shrink-0 snap-start">
      <div className="flex items-center gap-2 mb-3">
        <StatusBadge value={stage} type="deal" />
        <span className="text-xs text-slate-400">{deals.length}</span>
        {totalValue > 0 && (
          <span className="text-xs text-slate-400 ml-auto">
            {formatCurrency(totalValue)}
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 min-h-[200px] bg-slate-100 rounded-lg p-2"
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
