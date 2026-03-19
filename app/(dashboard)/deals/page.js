"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { apiGet, apiPatch } from "../../../lib/api";
import KanbanColumn from "../../../components/kanban-column";
import { formatCurrency } from "../../../lib/format";

const STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchDeals = useCallback(async () => {
    try {
      const data = await apiGet("/deals", { limit: 100 });
      setDeals(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = deals.filter((d) => d.stage === stage);
    return acc;
  }, {});

  const activeDeal = activeId
    ? deals.find((d) => d.id === activeId)
    : null;

  function findStageForDeal(dealId) {
    return deals.find((d) => d.id === dealId)?.stage;
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  async function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id;
    const currentStage = findStageForDeal(dealId);

    // Determine the target stage: could be dropping on a column or on another deal
    let targetStage = STAGES.includes(over.id)
      ? over.id
      : findStageForDeal(over.id);

    if (!targetStage || targetStage === currentStage) return;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d))
    );

    try {
      await apiPatch(`/deals/${dealId}/stage`, { stage: targetStage });
    } catch {
      // Revert on failure
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, stage: currentStage } : d
        )
      );
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Deals</h1>
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse mt-2" />
        </div>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s} className="w-64 sm:w-72 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-4 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="bg-slate-100 rounded-lg p-2 space-y-2 min-h-[200px]">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm p-3 space-y-2">
                    <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Deals</h1>
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchDeals}
            className="mt-3 px-4 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500 mt-1">
            {deals.length} deals &middot; {formatCurrency(totalValue)} total
            pipeline
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory md:snap-none md:mx-0 md:px-0">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              deals={dealsByStage[stage]}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <div className="bg-white rounded-lg shadow-lg p-3 w-72 rotate-2">
              <p className="text-sm font-medium text-slate-900 truncate">
                {activeDeal.name}
              </p>
              {activeDeal.value != null && (
                <p className="text-sm text-slate-600 mt-1">
                  {formatCurrency(activeDeal.value)}
                </p>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
