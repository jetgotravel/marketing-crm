"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiFetch } from "../../../lib/api";
import Loading from "../../../components/loading";
import EmptyState from "../../../components/empty-state";
import { formatDate, formatRelative } from "../../../lib/format";

const DIRECTION_STYLES = {
  sent: { label: "Sent", bg: "bg-blue-100 text-blue-700" },
  received: { label: "Reply", bg: "bg-green-100 text-green-700" },
  manual_reply: { label: "Manual Reply", bg: "bg-purple-100 text-purple-700" },
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "received", label: "Replies" },
  { value: "manual_reply", label: "Manual Replies" },
];

export default function InboxPage() {
  const [emails, setEmails] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDirectSends, setPendingDirectSends] = useState([]);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: String(page), limit: "30" };
      if (filter) params.direction = filter;
      const res = await apiGet("/inbox", params);
      setEmails(res.data || []);
      setPagination(res.pagination || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  // Check for pending direct sends
  const fetchPending = useCallback(async () => {
    try {
      const res = await apiGet("/send-queue", { status: "pending", limit: "100" });
      const direct = (res.data || []).filter(s => s.send_type === 'direct');
      setPendingDirectSends(direct);
    } catch {}
  }, []);

  useEffect(() => { fetchEmails(); fetchPending(); }, [fetchEmails, fetchPending]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pagination ? `${pagination.total} emails` : "All sent and received emails"}
          </p>
        </div>
      </div>

      {/* Pending direct sends banner */}
      {pendingDirectSends.length > 0 && (
        <PendingDirectSendsBanner items={pendingDirectSends} onActivated={() => { fetchEmails(); fetchPending(); }} />
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === f.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : emails.length === 0 ? (
        <EmptyState title="No emails" description="Emails sent from sequences and direct sends will appear here" />
      ) : (
        <div className="space-y-2">
          {emails.map(email => {
            const dirStyle = DIRECTION_STYLES[email.direction] || DIRECTION_STYLES.sent;
            return (
              <div key={email.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${dirStyle.bg}`}>
                        {dirStyle.label}
                      </span>
                      {email.sequence_id && (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 font-medium">
                          Sequence
                        </span>
                      )}
                      {!email.sequence_id && email.direction === 'sent' && (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">
                          Direct
                        </span>
                      )}
                      {!email.read && email.direction === 'received' && (
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {email.subject || "(no subject)"}
                    </p>
                    {email.body_snippet && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {email.body_snippet}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0 text-right">
                    <div>{formatRelative(email.created_at)}</div>
                    <div className="mt-0.5 font-mono text-[10px]">
                      {email.gmail_thread_id?.slice(0, 8)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {pagination && pagination.total_pages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-xs rounded border border-slate-200 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-xs text-slate-500">
                Page {page} of {pagination.total_pages}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= pagination.total_pages}
                className="px-3 py-1 text-xs rounded border border-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PendingDirectSendsBanner({ items, onActivated }) {
  const [password, setPassword] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  async function handleActivate() {
    if (!password) { setError("Password required"); return; }
    setActivating(true);
    setError("");
    try {
      await apiFetch("/emails/bulk-send/activate", {
        method: "POST",
        body: JSON.stringify({ password, send_queue_ids: items.map(i => i.id) }),
      });
      setShowConfirm(false);
      setPassword("");
      onActivated();
    } catch (err) {
      setError(err.message);
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-amber-900">{items.length} direct email(s) pending</p>
          <p className="text-xs text-amber-700">Custom emails queued by your agent. Review and activate to send.</p>
        </div>
        <button
          onClick={() => { setShowConfirm(true); setPassword(""); setError(""); }}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
        >
          Review & Send
        </button>
      </div>

      {showConfirm && (
        <div className="mt-4 pt-4 border-t border-amber-200">
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className="text-xs text-slate-700 bg-white rounded p-2">
                <span className="font-medium">{item.custom_subject}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm"
              placeholder="Enter password to send"
            />
            <button
              onClick={handleActivate}
              disabled={activating || !password}
              className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {activating ? "Sending..." : "Confirm & Send"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
