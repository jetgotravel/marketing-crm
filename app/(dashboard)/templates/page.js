"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiFetch } from "../../../lib/api";
import Loading from "../../../components/loading";
import EmptyState from "../../../components/empty-state";
import VariableReference from "../../../components/variable-reference";
import { formatDate } from "../../../lib/format";

const CATEGORIES = ["cold_outreach", "follow_up", "intro", "breakup", "referral"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet("/templates", { limit: "100" });
      setTemplates(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null); }}
          className="px-4 py-2 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          New Template
        </button>
      </div>

      <VariableReference mode="reference" />

      {(showCreate || editId) && (
        <TemplateForm
          templateId={editId}
          onSaved={() => { setShowCreate(false); setEditId(null); fetchTemplates(); }}
          onCancel={() => { setShowCreate(false); setEditId(null); }}
        />
      )}

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : templates.length === 0 ? (
        <EmptyState title="No templates" description="Create your first email template" />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setEditId(t.id)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-slate-900">{t.name}</h3>
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                      {t.category?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 truncate">
                    Subject: {t.subject_template}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {t.body_template?.replace(/<[^>]*>/g, "")}
                  </p>
                </div>
                <div className="text-xs text-slate-400 ml-4 flex-shrink-0">
                  {formatDate(t.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateForm({ templateId, onSaved, onCancel }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("cold_outreach");
  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [error, setError] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (templateId) {
      setLoadingTemplate(true);
      apiGet(`/templates/${templateId}`)
        .then((res) => {
          const t = res.data || res;
          setName(t.name || "");
          setSubject(t.subject_template || "");
          setBody(t.body_template || "");
          setCategory(t.category || "cold_outreach");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoadingTemplate(false));
    }
  }, [templateId]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (templateId) {
        await apiFetch(`/templates/${templateId}`, {
          method: "PATCH",
          body: JSON.stringify({ name, subject_template: subject, body_template: body, category }),
        });
      } else {
        await apiFetch("/templates", {
          method: "POST",
          body: JSON.stringify({ name, subject_template: subject, body_template: body, category }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingTemplate) return <Loading />;

  return (
    <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-medium text-slate-900">
        {templateId ? "Edit Template" : "New Template"}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Template name"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Subject Line
          <span className="text-slate-400 font-normal ml-1">Use {"{{first_name}}"} for personalization</span>
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder='Quick question, {{first_name|default:"there"}}'
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder="Hi {{first_name}},&#10;&#10;..."
          required
        />
        <VariableReference
          mode="insert"
          onInsert={(varText) => {
            const el = bodyRef.current;
            if (el) {
              const start = el.selectionStart;
              const end = el.selectionEnd;
              const newBody = body.slice(0, start) + varText + body.slice(end);
              setBody(newBody);
              setTimeout(() => {
                el.focus();
                el.selectionStart = el.selectionEnd = start + varText.length;
              }, 0);
            } else {
              setBody(body + varText);
            }
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : templateId ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
