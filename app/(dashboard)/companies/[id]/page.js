"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import DataTable from "../../../../components/data-table";
import StatusBadge from "../../../../components/status-badge";
import Loading from "../../../../components/loading";
import EmptyState from "../../../../components/empty-state";
import { formatDate, formatNumber } from "../../../../lib/format";

const CONTACT_COLUMNS = [
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
    key: "created_at",
    label: "Created",
    render: (row) => formatDate(row.created_at),
  },
];

export default function CompanyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRes, contactsRes] = await Promise.all([
        apiGet(`/companies/${id}`),
        apiGet("/contacts", { company_id: id, limit: "100" }),
      ]);
      setCompany(companyRes.data || companyRes);
      setContacts(contactsRes.data || []);
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

  if (!company) {
    return <EmptyState title="Company not found" />;
  }

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div>
        <button
          onClick={() => router.push("/companies")}
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
          Back to Companies
        </button>
        <h1 className="text-2xl font-semibold text-slate-900">
          {company.name}
        </h1>
        {company.domain && (
          <p className="text-sm text-slate-500 mt-1">{company.domain}</p>
        )}
      </div>

      {/* Company info */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-4">
          Company Information
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Name" value={company.name} />
          <Field label="Domain" value={company.domain} />
          <Field label="Industry" value={company.industry} />
          <Field
            label="Employees"
            value={
              company.employee_count != null
                ? formatNumber(company.employee_count)
                : null
            }
          />
          <Field label="Location" value={company.location} />
          <Field label="Description" value={company.description} />
          <Field label="Created" value={formatDate(company.created_at)} />
        </dl>

        {/* Tags */}
        {company.tags?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Tags</p>
            <div className="flex gap-1.5 flex-wrap">
              {company.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Linked contacts */}
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
            onRowClick={(row) => router.push(`/contacts/${row.id}`)}
          />
        ) : (
          <EmptyState
            title="No contacts"
            description="No contacts linked to this company"
          />
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 capitalize">
        {label}
      </dt>
      <dd className="text-sm text-slate-900 mt-0.5">{value || "—"}</dd>
    </div>
  );
}
