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
  const [updating, setUpdating] = useState(null);

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
    setUpdating(dealId);

    try {
      await apiPatch(`/deals/${dealId}/stage`, { stage: targetStage });
    } catch {
      // Revert on failure
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, stage: currentStage } : d
        )
      );
    } finally {
      setUpdating(null);
    }
  }

  // Fallback: move deal via dropdown
  async function handleMoveStage(dealId, newStage) {
    const currentStage = findStageForDeal(dealId);
    if (newStage === currentStage) return;

    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
    );
    setUpdating(dealId);

    try {
      await apiPatch(`/deals/${dealId}/stage`, { stage: newStage });
    } catch {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, stage: currentStage } : d
        )
      );
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Deals</h1>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div
              key={s}
              className="w-72 shrink-0 h-64 bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Deals</h1>
        <p className="text-sm text-red-600">{error}</p>
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
        <div className="flex gap-4 overflow-x-auto pb-4">
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
