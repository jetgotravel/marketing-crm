"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import StatusBadge from "../../../../components/status-badge";
import ActivityItem from "../../../../components/activity-item";
import Loading from "../../../../components/loading";
import EmptyState from "../../../../components/empty-state";
import { formatDate, formatDateTime, formatRelative } from "../../../../lib/format";

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [contact, setContact] = useState(null);
  const [activities, setActivities] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactRes, activitiesRes, notesRes] = await Promise.all([
        apiGet(`/contacts/${id}`),
        apiGet(`/contacts/${id}/activities`, { limit: "50" }),
        apiGet(`/contacts/${id}/notes`, { limit: "50" }),
      ]);
      setContact(contactRes.data || contactRes);
      setActivities(activitiesRes.data || []);
      setNotes(notesRes.data || []);
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

  if (!contact) {
    return <EmptyState title="Contact not found" />;
  }

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    contact.email ||
    "Unknown";

  const enrichment = contact.enrichment_data;
  const enrichmentEntries = enrichment
    ? Object.entries(enrichment).filter(
        ([, v]) => v != null && v !== "" && v !== false
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div>
        <button
          onClick={() => router.push("/contacts")}
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
          Back to Contacts
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {fullName}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{contact.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {contact.lead_score != null && (
              <div className="text-center">
                <p className="text-2xl font-semibold text-slate-900">
                  {contact.lead_score}
                </p>
                <p className="text-xs text-slate-500">Lead Score</p>
              </div>
            )}
            <StatusBadge value={contact.status} type="contact" />
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-4">
          Contact Information
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="First Name" value={contact.first_name} />
          <Field label="Last Name" value={contact.last_name} />
          <Field label="Email" value={contact.email} />
          <Field label="Phone" value={contact.phone} />
          <Field
            label="Company"
            value={contact.company_name}
            link={
              contact.company_id
                ? `/companies/${contact.company_id}`
                : undefined
            }
            onClick={(href) => router.push(href)}
          />
          <Field label="Status" value={contact.status} />
          <Field label="Source" value={contact.source} />
          <Field label="Created" value={formatDate(contact.created_at)} />
          <Field
            label="Last Activity"
            value={formatRelative(contact.last_activity_at)}
          />
        </dl>

        {/* Tags */}
        {contact.tags?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Tags</p>
            <div className="flex gap-1.5 flex-wrap">
              {contact.tags.map((tag) => (
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

      {/* Enrichment data */}
      {enrichmentEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-slate-900 mb-4">
            Enrichment Data
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {enrichmentEntries.map(([key, value]) => (
              <Field
                key={key}
                label={key.replace(/_/g, " ")}
                value={typeof value === "object" ? JSON.stringify(value) : String(value)}
              />
            ))}
          </dl>
        </div>
      )}

      {/* Sequence enrollments */}
      {contact.sequences?.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-slate-900 mb-4">
            Sequence Enrollments
          </h2>
          <div className="divide-y divide-slate-100">
            {contact.sequences.map((seq) => (
              <div
                key={seq.id || seq.sequence_id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {seq.sequence_name || seq.name || `Sequence ${seq.sequence_id}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Step {seq.current_step || "—"} &middot;{" "}
                    {seq.status || "active"}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  {formatDate(seq.enrolled_at || seq.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-4">
          Notes
          {notes.length > 0 && (
            <span className="text-slate-400 font-normal ml-1">
              ({notes.length})
            </span>
          )}
        </h2>
        {notes.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {notes.map((note) => (
              <div key={note.id} className="py-3">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {note.content || note.body || note.text}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatDateTime(note.created_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">
            No notes yet
          </p>
        )}
      </div>

      {/* Activity timeline */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-medium text-slate-900 mb-2">
          Activity Timeline
          {activities.length > 0 && (
            <span className="text-slate-400 font-normal ml-1">
              ({activities.length})
            </span>
          )}
        </h2>
        {activities.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {activities.map((a) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">
            No activity yet
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, link, onClick }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 capitalize">
        {label}
      </dt>
      <dd className="text-sm text-slate-900 mt-0.5">
        {link && value ? (
          <button
            onClick={() => onClick(link)}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {value}
          </button>
        ) : (
          value || "—"
        )}
      </dd>
    </div>
  );
}
