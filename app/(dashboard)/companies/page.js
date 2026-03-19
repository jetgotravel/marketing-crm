"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../lib/api";
import DataTable from "../../../components/data-table";
import Loading from "../../../components/loading";
import EmptyState from "../../../components/empty-state";
import { formatNumber } from "../../../lib/format";

const PAGE_SIZE = 20;

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (row) => (
      <span className="font-medium text-slate-900">{row.name || "—"}</span>
    ),
  },
  {
    key: "domain",
    label: "Domain",
    render: (row) =>
      row.domain ? (
        <span className="text-blue-600">{row.domain}</span>
      ) : (
        "—"
      ),
  },
  {
    key: "industry",
    label: "Industry",
    render: (row) => row.industry || "—",
  },
  {
    key: "employee_count",
    label: "Employees",
    render: (row) =>
      row.employee_count != null ? formatNumber(row.employee_count) : "—",
  },
  {
    key: "contact_count",
    label: "Contacts",
    render: (row) =>
      row.contact_count != null ? formatNumber(row.contact_count) : "—",
  },
];

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (search.trim()) {
        res = await apiGet("/search", {
          q: search.trim(),
          types: "companies",
          page: String(page),
          limit: String(PAGE_SIZE),
        });
      } else {
        res = await apiGet("/companies", {
          page: String(page),
          limit: String(PAGE_SIZE),
        });
      }
      setCompanies(res.data || []);
      setPagination(res.pagination || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Companies</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pagination
            ? `${pagination.total} total companies`
            : "Manage your companies"}
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
            placeholder="Search companies by name or domain..."
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
      ) : companies.length === 0 ? (
        <EmptyState
          title="No companies found"
          description={
            search ? "Try a different search term" : "No companies yet"
          }
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={companies}
          onRowClick={(row) => router.push(`/companies/${row.id}`)}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
