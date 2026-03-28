import { createClient } from "@supabase/supabase-js";
import { verifyDashboardAuth } from "../../lib/auth";
import { redirect } from "next/navigation";
import StatCard from "../../components/stat-card";
import ActivityItem from "../../components/activity-item";
import { formatCurrency, formatNumber } from "../../lib/format";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEAL_STAGES = [
  { key: "lead", label: "Lead", color: "bg-slate-400" },
  { key: "qualified", label: "Qualified", color: "bg-blue-500" },
  { key: "proposal", label: "Proposal", color: "bg-amber-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-purple-500" },
  { key: "closed_won", label: "Won", color: "bg-emerald-500" },
  { key: "closed_lost", label: "Lost", color: "bg-red-500" },
];

export default async function DashboardPage() {
  const { authorized, tenant_id, user } = await verifyDashboardAuth();
  if (!authorized) redirect("/login");

  const [
    { count: totalContacts },
    { count: totalCompanies },
    { data: deals, count: totalDeals },
    { count: activeSequences },
    { data: activities },
  ] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
    supabase.from("deals").select("*", { count: "exact" }).eq("tenant_id", tenant_id).limit(100),
    supabase.from("sequences").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("status", "active"),
    supabase.from("activities").select("*").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(20),
  ]);

  // Group deals by stage
  const dealsByStage = {};
  for (const stage of DEAL_STAGES) {
    dealsByStage[stage.key] = { count: 0, value: 0 };
  }
  if (deals) {
    for (const deal of deals) {
      if (dealsByStage[deal.stage]) {
        dealsByStage[deal.stage].count++;
        dealsByStage[deal.stage].value += parseFloat(deal.value) || 0;
      }
    }
  }

  const totalPipelineValue = Object.values(dealsByStage).reduce(
    (sum, s) => sum + s.value,
    0
  );

  const maxStageCount = Math.max(
    1,
    ...Object.values(dealsByStage).map((s) => s.count)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.name ? `Welcome, ${user.name}` : "CRM overview"}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Contacts" value={formatNumber(totalContacts ?? 0)} />
        <StatCard label="Companies" value={formatNumber(totalCompanies ?? 0)} />
        <StatCard
          label="Deals"
          value={formatNumber(totalDeals ?? 0)}
          sub={`${formatCurrency(totalPipelineValue)} pipeline`}
        />
        <StatCard label="Active Sequences" value={formatNumber(activeSequences ?? 0)} />
      </div>

      {/* Deal pipeline */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-4">
          Deal Pipeline
        </h2>
        <div className="space-y-3">
          {DEAL_STAGES.map((stage) => {
            const data = dealsByStage[stage.key];
            const pct = (data.count / maxStageCount) * 100;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-24 shrink-0">
                  {stage.label}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                  {data.count > 0 && (
                    <div
                      className={`${stage.color} h-full rounded-full flex items-center justify-end pr-2 transition-all`}
                      style={{ width: `${Math.max(pct, 8)}%` }}
                    >
                      <span className="text-[10px] font-medium text-white">
                        {data.count}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-500 w-20 text-right shrink-0">
                  {formatCurrency(data.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-2">
          Recent Activity
        </h2>
        {activities?.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {activities.map((a) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-6 text-center">
            No activity yet
          </p>
        )}
      </div>
    </div>
  );
}
