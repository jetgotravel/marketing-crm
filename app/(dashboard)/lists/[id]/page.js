"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import DataTable from "../../../../components/data-table";
import StatusBadge from "../../../../components/status-badge";
import Loading from "../../../../components/loading";
import EmptyState from "../../../../components/empty-state";
import { formatDate, formatRelative } from "../../../../lib/format";

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
    key: "status",
    label: "Status",
    render: (row) => <StatusBadge value={row.status} type="contact" />,
  },
  {
    key: "last_activity_at",
    label: "Last Activity",
    render: (row) => formatRelative(row.last_activity_at),
  },
  {
    key: "created_at",
    label: "Added",
    render: (row) => formatDate(row.created_at),
  },
];

export default function ListDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet(`/lists/${id}`);
      setList(res.data || res);
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
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!list) {
    return <EmptyState title="List not found" />;
  }

  const contacts = list.contacts || [];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/lists")}
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
          Back to Lists
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {list.name}
            </h1>
            {list.description && (
              <p className="text-sm text-slate-500 mt-1">{list.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ListTypeBadge value={list.type || list.list_type} />
            {list.contact_count != null && (
              <span className="text-sm text-slate-500">
                {list.contact_count} contacts
              </span>
            )}
          </div>
        </div>
      </div>

      {/* List Info */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-4">
          List Details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">Name</dt>
            <dd className="text-sm text-slate-900 mt-0.5">{list.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Type</dt>
            <dd className="text-sm text-slate-900 mt-0.5">
              {list.type || list.list_type || "static"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Created</dt>
            <dd className="text-sm text-slate-900 mt-0.5">
              {formatDate(list.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">
              Contact Count
            </dt>
            <dd className="text-sm text-slate-900 mt-0.5">
              {list.contact_count ?? contacts.length}
            </dd>
          </div>
        </dl>
      </div>

      {/* Contacts */}
      <div>
        <h2 className="text-sm font-medium text-slate-900 mb-3">
          Contacts
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
            onRowClick={(row) =>
              router.push(`/contacts/${row.id || row.contact_id}`)
            }
          />
        ) : (
          <EmptyState
            title="No contacts"
            description="This list has no contacts yet"
          />
        )}
      </div>
    </div>
  );
}
