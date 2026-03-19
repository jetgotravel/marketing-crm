"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import DataTable from "../../../../components/data-table";
import StatusBadge from "../../../../components/status-badge";
import Loading from "../../../../components/loading";
import EmptyState from "../../../../components/empty-state";
import { formatDate, formatNumber, formatPercent } from "../../../../lib/format";

const STATUS_COLORS = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-700",
  completed: "bg-blue-100 text-blue-700",
};

function SequenceStatusBadge({ value }) {
  const classes = STATUS_COLORS[value] || "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}
    >
      {value?.replace(/_/g, " ")}
    </span>
  );
}

const STEP_TYPE_LABELS = {
  email: "Email",
  wait: "Wait",
  condition: "Condition",
  task: "Task",
};

const CONTACT_COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (row) => (
      <span className="font-medium text-slate-900">
        {[row.first_name, row.last_name].filter(Boolean).join(" ") ||
          row.email ||
          "—"}
      </span>
    ),
  },
  { key: "email", label: "Email" },
  {
    key: "current_step",
    label: "Current Step",
    render: (row) => row.current_step ?? "—",
  },
  {
    key: "status",
    label: "Status",
    render: (row) => <StatusBadge value={row.status || row.enrollment_status} type="contact" />,
  },
  {
    key: "enrolled_at",
    label: "Enrolled",
    render: (row) => formatDate(row.enrolled_at || row.created_at),
  },
];

export default function SequenceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [sequence, setSequence] = useState(null);
  const [steps, setSteps] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [seqRes, stepsRes, statsRes] = await Promise.all([
        apiGet(`/sequences/${id}`),
        apiGet(`/sequences/${id}/steps`),
        apiGet(`/sequences/${id}/stats`).catch(() => null),
      ]);
      setSequence(seqRes.data || seqRes);
      setSteps(stepsRes.data || []);
      setStats(statsRes?.data || statsRes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!sequence) {
    return <EmptyState title="Sequence not found" />;
  }

  const contacts = sequence.contacts || sequence.enrolled_contacts || [];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/sequences")}
          className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Sequences
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {sequence.name}
            </h1>
            {sequence.description && (
              <p className="text-sm text-slate-500 mt-1">
                {sequence.description}
              </p>
            )}
          </div>
          <SequenceStatusBadge value={sequence.status} />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Enrolled", value: formatNumber(stats.enrolled_count ?? stats.total_enrolled) },
            { label: "Completed", value: formatNumber(stats.completed_count ?? stats.total_completed) },
            { label: "Open Rate", value: formatPercent(stats.open_rate) },
            { label: "Reply Rate", value: formatPercent(stats.reply_rate) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-lg shadow-sm p-4"
            >
              <p className="text-xs font-medium text-slate-500">
                {stat.label}
              </p>
              <p className="text-xl font-semibold text-slate-900 mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-4">
          Steps
          {steps.length > 0 && (
            <span className="text-slate-400 font-normal ml-1">
              ({steps.length})
            </span>
          )}
        </h2>
        {steps.length > 0 ? (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.id || i}
                className="flex items-start gap-4 p-3 rounded-lg border border-slate-100"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-slate-600">
                    {step.step_order ?? i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">
                      {STEP_TYPE_LABELS[step.type] || step.type || "Email"}
                    </span>
                    {step.delay_days != null && step.delay_days > 0 && (
                      <span className="text-xs text-slate-400">
                        +{step.delay_days}d delay
                      </span>
                    )}
                    {step.delay_hours != null && step.delay_hours > 0 && (
                      <span className="text-xs text-slate-400">
                        +{step.delay_hours}h delay
                      </span>
                    )}
                  </div>
                  {step.subject && (
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {step.subject}
                    </p>
                  )}
                  {step.body && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {step.body}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">
            No steps defined
          </p>
        )}
      </div>

      {/* Enrolled Contacts */}
      <div>
        <h2 className="text-sm font-medium text-slate-900 mb-3">
          Enrolled Contacts
          {contacts.length > 0 && (
            <span className="text-slate-400 font-normal ml-1">
              ({contacts.length})
            </span>
          )}
        </h2>
        {contacts.length > 0 ? (
          <DataTable
            columns={CONTACT_COLUMNS}
            rows={contacts}
            onRowClick={(row) => router.push(`/contacts/${row.id || row.contact_id}`)}
          />
        ) : (
          <EmptyState
            title="No enrolled contacts"
            description="No contacts are currently enrolled in this sequence"
          />
        )}
      </div>
    </div>
  );
}
