"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../lib/api";
import DataTable from "../../../components/data-table";
import Loading from "../../../components/loading";
import EmptyState from "../../../components/empty-state";
import { formatDate } from "../../../lib/format";

const PAGE_SIZE = 20;

const TYPE_COLORS = {
  static: "bg-slate-100 text-slate-700",
  dynamic: "bg-blue-100 text-blue-700",
};

function ListTypeBadge({ value }) {
  const classes = TYPE_COLORS[value] || "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}
    >
      {value || "static"}
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
    key: "type",
    label: "Type",
    render: (row) => <ListTypeBadge value={row.type || row.list_type} />,
  },
  {
    key: "contact_count",
    label: "Contacts",
    render: (row) => row.contact_count ?? "—",
  },
  {
    key: "created_at",
    label: "Created",
    render: (row) => formatDate(row.created_at),
  },
];

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet("/lists", {
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      setLists(res.data || []);
      setPagination(res.pagination || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lists</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pagination
            ? `${pagination.total} total lists`
            : "Manage your contact lists"}
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchLists}
            className="mt-3 px-4 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : lists.length === 0 ? (
        <EmptyState
          title="No lists found"
          description="No lists have been created yet"
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={lists}
          onRowClick={(row) => router.push(`/lists/${row.id}`)}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
