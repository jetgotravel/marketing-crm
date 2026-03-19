"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../lib/api";
import DataTable from "../../../components/data-table";
import StatusBadge from "../../../components/status-badge";
import Loading from "../../../components/loading";
import EmptyState from "../../../components/empty-state";
import { formatDate, formatRelative } from "../../../lib/format";

const PAGE_SIZE = 20;

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (row) => (
      <span className="font-medium text-slate-900">
        {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
      </span>
    ),
  },
  { key: "email", label: "Email" },
  {
    key: "company",
    label: "Company",
    render: (row) => row.company_name || "—",
  },
  {
    key: "status",
    label: "Status",
    render: (row) => <StatusBadge value={row.status} type="contact" />,
  },
  {
    key: "lead_score",
    label: "Score",
    render: (row) =>
      row.lead_score != null ? (
        <span className="font-medium">{row.lead_score}</span>
      ) : (
        "—"
      ),
  },
  {
    key: "tags",
    label: "Tags",
    render: (row) =>
      row.tags?.length > 0 ? (
        <div className="flex gap-1 flex-wrap">
          {row.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600"
            >
              {tag}
            </span>
          ))}
          {row.tags.length > 3 && (
            <span className="text-xs text-slate-400">
              +{row.tags.length - 3}
            </span>
          )}
        </div>
      ) : (
        "—"
      ),
  },
  {
    key: "last_activity_at",
    label: "Last Activity",
    render: (row) => formatRelative(row.last_activity_at),
  },
  {
    key: "created_at",
    label: "Created",
    render: (row) => formatDate(row.created_at),
  },
];

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (search.trim()) {
        res = await apiGet("/search", {
          q: search.trim(),
          types: "contacts",
          page: String(page),
          limit: String(PAGE_SIZE),
        });
      } else {
        res = await apiGet("/contacts", {
          page: String(page),
          limit: String(PAGE_SIZE),
        });
      }
      setContacts(res.data || []);
      setPagination(res.pagination || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pagination
            ? `${pagination.total} total contacts`
            : "Manage your contacts"}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts by name or email..."
            className="block w-full pl-10 pr-3 py-2 rounded-md border border-slate-300 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No contacts found"
          description={search ? "Try a different search term" : "No contacts yet"}
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={contacts}
          onRowClick={(row) => router.push(`/contacts/${row.id}`)}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
