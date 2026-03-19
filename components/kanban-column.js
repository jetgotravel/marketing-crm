import StatusBadge from "./status-badge";

export default function KanbanColumn({ stage, count, children }) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <StatusBadge value={stage} type="deal" />
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      <div className="flex-1 space-y-2 min-h-[200px] bg-slate-100 rounded-lg p-2">
        {children}
      </div>
    </div>
  );
}
