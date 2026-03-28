"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiFetch } from "../../../../lib/api";
import DataTable from "../../../../components/data-table";
import StatusBadge from "../../../../components/status-badge";
import Loading from "../../../../components/loading";
import EmptyState from "../../../../components/empty-state";
import VariableReference from "../../../../components/variable-reference";
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
    label: "Step",
    render: (row) => (
      <span className="text-sm text-slate-600">
        {row.current_step ?? "—"}
      </span>
    ),
  },
  {
    key: "enrollment_status",
    label: "Status",
    render: (row) => <StatusBadge value={row.enrollment_status} type="contact" />,
  },
  {
    key: "sender_email",
    label: "Sender",
    render: (row) => (
      <span className="text-sm text-slate-500">
        {row.sender_name || row.sender_email || "—"}
      </span>
    ),
  },
  {
    key: "enrolled_at",
    label: "Enrolled",
    render: (row) => formatDate(row.enrolled_at),
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

  const [enrolledContacts, setEnrolledContacts] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [seqRes, stepsRes, statsRes, enrollRes] = await Promise.all([
        apiGet(`/sequences/${id}`),
        apiGet(`/sequences/${id}/steps`),
        apiGet(`/sequences/${id}/stats`).catch(() => null),
        apiGet(`/sequences/${id}/enrollments`).catch(() => null),
      ]);
      setSequence(seqRes.data || seqRes);
      setSteps(stepsRes.data || []);
      setStats(statsRes?.data || statsRes);
      setEnrolledContacts(enrollRes?.data || []);
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

  if (!sequence) {
    return <EmptyState title="Sequence not found" />;
  }

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
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
          <div className="flex items-center gap-2">
            <SequenceStatusBadge value={sequence.status} />
            {sequence.status === 'draft' && (
              <ActivateSequenceButton sequenceId={id} onActivated={fetchData} />
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Enrolled", value: formatNumber(stats.overall?.total ?? stats.enrolled_count ?? 0) },
            { label: "Replied", value: formatNumber(stats.overall?.replied ?? 0) },
            { label: "Completed", value: formatNumber(stats.overall?.completed ?? 0) },
            { label: "Reply Rate", value: formatPercent(stats.overall?.reply_rate) },
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
      <StepsSection sequenceId={id} steps={steps} onStepsChanged={fetchData} />

      {/* Pending Review */}
      <PendingReviewSection
        sequenceId={id}
        enrollments={enrolledContacts}
        onActivated={fetchData}
      />

      {/* Active / Completed Enrollments */}
      <div>
        <h2 className="text-sm font-medium text-slate-900 mb-3">
          Enrolled Contacts
          {enrolledContacts.filter(e => e.enrollment_status !== 'pending_review').length > 0 && (
            <span className="text-slate-400 font-normal ml-1">
              ({enrolledContacts.filter(e => e.enrollment_status !== 'pending_review').length})
            </span>
          )}
        </h2>
        {enrolledContacts.filter(e => e.enrollment_status !== 'pending_review').length > 0 ? (
          <DataTable
            columns={CONTACT_COLUMNS}
            rows={enrolledContacts.filter(e => e.enrollment_status !== 'pending_review')}
            onRowClick={(row) => router.push(`/contacts/${row.id}`)}
          />
        ) : (
          <EmptyState
            title="No active enrollments"
            description="Activate pending contacts above to start sending"
          />
        )}
      </div>
    </div>
  );
}

function ActivateSequenceButton({ sequenceId, onActivated }) {
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!password) { setError("Password required"); return; }
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/sequences/${sequenceId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active", password }),
      });
      setShow(false);
      setPassword("");
      onActivated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setShow(true); setPassword(""); setError(""); }}
        className="px-3 py-1 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
      >
        Activate Sequence
      </button>
      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-slate-900 mb-1">Activate Sequence</h3>
            <p className="text-xs text-slate-500 mb-4">
              This allows contacts to be enrolled and emails to be sent from this sequence. Enter your password to confirm.
            </p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
              placeholder="Password"
              autoFocus
            />
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShow(false)} className="px-4 py-2 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handleConfirm} disabled={loading || !password} className="px-4 py-2 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                {loading ? "Activating..." : "Confirm & Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StepsSection({ sequenceId, steps, onStepsChanged }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editStep, setEditStep] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ step_order: "", delay_days: "0", step_type: "email", subject: "", body_template: "", variant_key: "A" });
  const stepBodyRef = useRef(null);

  function openAdd() {
    const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order || 0)) + 1 : 1;
    setForm({ step_order: String(nextOrder), delay_days: "0", step_type: "email", subject: "", body_template: "", variant_key: "A" });
    setEditStep(null);
    setShowAdd(true);
  }

  function openEdit(step) {
    setForm({
      step_order: String(step.step_order || ""),
      delay_days: String(step.delay_days || 0),
      step_type: step.step_type || "email",
      subject: step.subject || "",
      body_template: step.body_template || "",
      variant_key: step.variant_key || "A",
    });
    setEditStep(step);
    setShowAdd(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        step_order: parseInt(form.step_order, 10),
        delay_days: parseInt(form.delay_days, 10) || 0,
        step_type: form.step_type,
        subject: form.subject,
        body_template: form.body_template,
        variant_key: form.variant_key,
      };

      if (editStep?.id) {
        // Update existing step
        await apiFetch(`/sequences/${sequenceId}/steps`, {
          method: "PATCH",
          body: JSON.stringify({ step_id: editStep.id, ...payload }),
        });
      } else {
        // Create new step
        await apiFetch(`/sequences/${sequenceId}/steps`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowAdd(false);
      setEditStep(null);
      onStepsChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editStep?.id || !confirm("Delete this step?")) return;
    setSaving(true);
    try {
      await apiFetch(`/sequences/${sequenceId}/steps?step_id=${editStep.id}`, { method: "DELETE" });
      setShowAdd(false);
      setEditStep(null);
      onStepsChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-900">
          Steps
          {steps.length > 0 && (
            <span className="text-slate-400 font-normal ml-1">({steps.length})</span>
          )}
        </h2>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          Add Step
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleSave} className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50/50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Order</label>
              <input type="number" value={form.step_order} onChange={e => setForm(f => ({...f, step_order: e.target.value}))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Delay (days)</label>
              <input type="number" value={form.delay_days} onChange={e => setForm(f => ({...f, delay_days: e.target.value}))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={form.step_type} onChange={e => setForm(f => ({...f, step_type: e.target.value}))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="task">Task</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Variant</label>
              <input value={form.variant_key} onChange={e => setForm(f => ({...f, variant_key: e.target.value}))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="A" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Email subject line" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
            <textarea ref={stepBodyRef} value={form.body_template} onChange={e => setForm(f => ({...f, body_template: e.target.value}))} rows={5} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono" placeholder="Hi {{first_name}},&#10;&#10;..." />
            <VariableReference
              mode="insert"
              onInsert={(varText) => {
                const el = stepBodyRef.current;
                if (el) {
                  const start = el.selectionStart;
                  const end = el.selectionEnd;
                  const newVal = form.body_template.slice(0, start) + varText + form.body_template.slice(end);
                  setForm(f => ({ ...f, body_template: newVal }));
                  setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + varText.length; }, 0);
                } else {
                  setForm(f => ({ ...f, body_template: f.body_template + varText }));
                }
              }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            {editStep?.id && (
              <button type="button" onClick={handleDelete} disabled={saving} className="px-3 py-1.5 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 mr-auto">
                Delete Step
              </button>
            )}
            <button type="button" onClick={() => { setShowAdd(false); setEditStep(null); }} className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50">
              {saving ? "Saving..." : editStep ? "Update Step" : "Add Step"}
            </button>
          </div>
        </form>
      )}

      {steps.length > 0 ? (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.id || i}
              className="flex items-start gap-4 p-3 rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition-colors"
              onClick={() => openEdit(step)}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600">
                  {step.step_order ?? i + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">
                    {STEP_TYPE_LABELS[step.step_type] || step.step_type || "Email"}
                  </span>
                  {step.variant_key && step.variant_key !== "A" && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-medium">
                      Variant {step.variant_key}
                    </span>
                  )}
                  {step.delay_days != null && step.delay_days > 0 && (
                    <span className="text-xs text-slate-400">+{step.delay_days}d delay</span>
                  )}
                </div>
                {step.subject && (
                  <p className="text-sm font-medium text-slate-900 truncate">{step.subject}</p>
                )}
                {step.body_template && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-3 whitespace-pre-line">
                    {step.body_template.replace(/<[^>]*>/g, "")}
                  </p>
                )}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">click to edit</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 text-center py-4">No steps defined</p>
      )}
    </div>
  );
}

function PendingReviewSection({ sequenceId, enrollments, onActivated }) {
  const [selected, setSelected] = useState(new Set());
  const [activating, setActivating] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const pending = enrollments.filter(e => e.enrollment_status === 'pending_review');

  if (pending.length === 0) return null;

  const allSelected = selected.size === pending.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending.map(e => e.enrollment_id)));
    }
  }

  function toggleOne(enrollmentId) {
    const next = new Set(selected);
    if (next.has(enrollmentId)) next.delete(enrollmentId);
    else next.add(enrollmentId);
    setSelected(next);
  }

  function requestActivation(ids) {
    setPendingActivation(ids);
    setPassword("");
    setPasswordError("");
    setShowPasswordPrompt(true);
  }

  async function confirmActivation() {
    if (!password) { setPasswordError("Password required"); return; }
    setActivating(true);
    setPasswordError("");
    try {
      const body = pendingActivation ? { enrollment_ids: pendingActivation, password } : { password };
      await apiFetch(`/sequences/${sequenceId}/activate`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSelected(new Set());
      setShowPasswordPrompt(false);
      setPendingActivation(null);
      setPassword("");
      onActivated();
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-amber-900">
            Pending Review
            <span className="text-amber-600 font-normal ml-1">({pending.length})</span>
          </h2>
          <p className="text-xs text-amber-700 mt-0.5">
            These contacts are queued but no emails will send until you activate them.
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => requestActivation([...selected])}
              disabled={activating}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              Activate {selected.size} Selected
            </button>
          )}
          <button
            onClick={() => requestActivation(null)}
            disabled={activating}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Activate All
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="rounded border-amber-300"
          />
          Select all
        </label>
        {pending.map(contact => (
          <label
            key={contact.enrollment_id}
            className="flex items-center gap-3 p-2 rounded border border-amber-100 bg-white cursor-pointer hover:border-amber-300 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(contact.enrollment_id)}
              onChange={() => toggleOne(contact.enrollment_id)}
              className="rounded border-amber-300"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-900">
                {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email}
              </span>
              {contact.first_name && (
                <span className="text-xs text-slate-500 ml-2">{contact.email}</span>
              )}
            </div>
            {contact.sender_name && (
              <span className="text-xs text-slate-500">via {contact.sender_name}</span>
            )}
          </label>
        ))}
      </div>

      {/* Password confirmation modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPasswordPrompt(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-slate-900 mb-1">Confirm Activation</h3>
            <p className="text-xs text-slate-500 mb-4">
              {pendingActivation
                ? `Activate ${pendingActivation.length} selected enrollment(s). Emails will start sending after a 24-hour delay.`
                : `Activate all ${pending.length} pending enrollment(s). Emails will start sending after a 24-hour delay.`
              }
            </p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Enter your password to confirm</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmActivation()}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Password"
                autoFocus
              />
            </div>
            {passwordError && <p className="text-xs text-red-600 mb-3">{passwordError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowPasswordPrompt(false)}
                className="px-4 py-2 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmActivation}
                disabled={activating || !password}
                className="px-4 py-2 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {activating ? "Activating..." : "Confirm & Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
