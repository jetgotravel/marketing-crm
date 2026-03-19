"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../lib/api";
import DataTable from "../../../components/data-table";
import StatusBadge from "../../../components/status-badge";
import Loading from "../../../components/loading";
import EmptyState from "../../../components/empty-state";
import { formatDate } from "../../../lib/format";

const PAGE_SIZE = 20;

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

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (row) => (
      <span className="font-medium text-slate-900">{row.name || "—"}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (row) => <SequenceStatusBadge value={row.status} />,
  },
  {
    key: "step_count",
    label: "Steps",
    render: (row) => row.step_count ?? "—",
  },
  {
    key: "enrolled_count",
    label: "Enrolled",
    render: (row) => row.enrolled_count ?? row.contact_count ?? "—",
  },
  {
    key: "created_at",
    label: "Created",
    render: (row) => formatDate(row.created_at),
  },
];

export default function SequencesPage() {
  const router = useRouter();
  const [sequences, setSequences] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet("/sequences", {
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      setSequences(res.data || []);
      setPagination(res.pagination || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sequences</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pagination
            ? `${pagination.total} total sequences`
            : "Manage your email sequences"}
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : sequences.length === 0 ? (
        <EmptyState
          title="No sequences found"
          description="No sequences have been created yet"
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={sequences}
          onRowClick={(row) => router.push(`/sequences/${row.id}`)}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
