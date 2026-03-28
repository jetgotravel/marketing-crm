"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "../../../lib/api";
import Loading from "../../../components/loading";
import EmptyState from "../../../components/empty-state";
import { formatDate } from "../../../lib/format";

export default function ImportsPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [batchContacts, setBatchContacts] = useState({});

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet("/imports", { limit: "50" });
      setBatches(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  async function toggleExpand(batchId) {
    if (expanded === batchId) {
      setExpanded(null);
      return;
    }
    setExpanded(batchId);
    if (!batchContacts[batchId]) {
      try {
        const res = await apiGet(`/imports/${batchId}/contacts`, { limit: "100" });
        setBatchContacts((prev) => ({ ...prev, [batchId]: res.data || [] }));
      } catch {
        setBatchContacts((prev) => ({ ...prev, [batchId]: [] }));
      }
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Imports</h1>
        <p className="text-sm text-slate-500 mt-1">
          {batches.length} import batch{batches.length !== 1 ? "es" : ""}
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : batches.length === 0 ? (
        <EmptyState
          title="No imports yet"
          description="Contacts and companies imported via bulk_import will appear here grouped by batch"
        />
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(batch.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-slate-900">
                        {batch.name || "Unnamed Import"}
                      </h3>
                      <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                        {batch.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{batch.contact_count} contact{batch.contact_count !== 1 ? "s" : ""}</span>
                      <span>{batch.company_count} compan{batch.company_count !== 1 ? "ies" : "y"}</span>
                      <span>{formatDate(batch.created_at)}</span>
                    </div>
                    {batch.tags?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {batch.tags.map((tag) => (
                          <span key={tag} className="inline-flex px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs text-slate-400 font-mono">
                      {batch.id.slice(0, 8)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${expanded === batch.id ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {expanded === batch.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50">
                  {batchContacts[batch.id] ? (
                    batchContacts[batch.id].length > 0 ? (
                      <div className="space-y-1">
                        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-slate-500 pb-1 border-b border-slate-200">
                          <span>Name</span>
                          <span>Email</span>
                          <span>Company</span>
                          <span>Status</span>
                        </div>
                        {batchContacts[batch.id].map((c) => (
                          <div key={c.id} className="grid grid-cols-4 gap-2 text-sm text-slate-700 py-1">
                            <span className="truncate">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "-"}</span>
                            <span className="truncate text-slate-500">{c.email}</span>
                            <span className="truncate">{c.company || "-"}</span>
                            <span className="text-xs">
                              <span className={`inline-flex px-1.5 py-0.5 rounded ${
                                c.status === 'replied' ? 'bg-green-100 text-green-700' :
                                c.status === 'bounced' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {c.status}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-2">No contacts in this batch</p>
                    )
                  ) : (
                    <Loading />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
