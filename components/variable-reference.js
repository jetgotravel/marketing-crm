"use client";

import { useState } from "react";

const VARIABLE_GROUPS = [
  {
    label: "Core",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-500",
    vars: [
      { key: "first_name", column: "contacts.first_name", desc: "First name", example: "Sarah" },
      { key: "last_name", column: "contacts.last_name", desc: "Last name", example: "Chen" },
      { key: "email", column: "contacts.email", desc: "Email address", example: "sarah@acme.com" },
      { key: "company", column: "contacts.company", desc: "Company name", example: "Acme Corp" },
      { key: "title", column: "contacts.title", desc: "Job title", example: "VP of Marketing" },
      { key: "phone", column: "contacts.phone", desc: "Phone number", example: "+1-902-555-1234" },
      { key: "linkedin_url", column: "contacts.linkedin_url", desc: "LinkedIn URL", example: "linkedin.com/in/sarahchen" },
    ],
  },
  {
    label: "Enrichment",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    dotColor: "bg-violet-500",
    vars: [
      { key: "seniority", column: "contacts.seniority", desc: "Seniority level", example: "Director" },
      { key: "department", column: "contacts.department", desc: "Department", example: "Marketing" },
      { key: "city", column: "contacts.city", desc: "City", example: "Halifax" },
      { key: "country", column: "contacts.country", desc: "Country", example: "Canada" },
    ],
  },
  {
    label: "System",
    color: "bg-slate-50 text-slate-600 border-slate-200",
    dotColor: "bg-slate-400",
    vars: [
      { key: "source", column: "contacts.source", desc: "How added (scraped, manual, imported, enriched)", example: "imported" },
      { key: "status", column: "contacts.status", desc: "Pipeline status", example: "qualified" },
      { key: "score", column: "contacts.score", desc: "Lead score", example: "85" },
    ],
  },
];

/**
 * Variable reference panel for email templates.
 * - mode="reference": Full guide view (for templates page)
 * - mode="insert": Compact insert tool (click to copy/insert)
 * - onInsert: callback(variableString) when a variable is clicked in insert mode
 */
export default function VariableReference({ mode = "reference", onInsert }) {
  const [open, setOpen] = useState(mode === "reference");
  const [copied, setCopied] = useState(null);
  const [withDefault, setWithDefault] = useState(false);

  function handleClick(varKey) {
    const text = withDefault
      ? `{{${varKey}|default:""}}`
      : `{{${varKey}}}`;

    if (onInsert) {
      onInsert(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopied(varKey);
    setTimeout(() => setCopied(null), 1200);
  }

  if (mode === "insert") {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          {open ? "Hide variables" : "Insert variable"}
        </button>

        {open && (
          <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={withDefault}
                  onChange={() => setWithDefault(!withDefault)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Include default
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLE_GROUPS.flatMap((g) =>
                g.vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleClick(v.key)}
                    title={`${v.desc} — ${v.example}`}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-all ${
                      copied === v.key
                        ? "bg-green-50 text-green-700 border-green-300"
                        : `${g.color} hover:opacity-80`
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${g.dotColor}`} />
                    {`{{${v.key}}}`}
                    {copied === v.key && <span className="text-green-600 ml-1">&#10003;</span>}
                  </button>
                ))
              )}
              <button
                type="button"
                onClick={() => handleClick("custom.field_name")}
                title="Custom field — replace field_name with your custom field key"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-all ${
                  copied === "custom.field_name"
                    ? "bg-green-50 text-green-700 border-green-300"
                    : "bg-amber-50 text-amber-700 border-amber-200 hover:opacity-80"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {`{{custom.*}}`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full reference mode
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          <span className="text-sm font-medium text-slate-900">Template Variable Reference</span>
          <span className="text-xs text-slate-400">Click any variable to copy</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-slate-100">
          {/* Syntax help */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs font-mono space-y-1">
            <div className="flex gap-2">
              <span className="text-emerald-600">{"{{variable}}"}</span>
              <span className="text-slate-400">— pulls value, empty if missing</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-600">{"{{variable|default:\"fallback\"}}"}</span>
              <span className="text-slate-400">— uses fallback when empty</span>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-600">{"{{custom.field_name}}"}</span>
              <span className="text-slate-400">— contact custom field</span>
            </div>
          </div>

          {/* Toggle for default syntax */}
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withDefault}
              onChange={() => setWithDefault(!withDefault)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Copy with default syntax
          </label>

          {/* Variable groups */}
          {VARIABLE_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                {group.label} Fields
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                      <th className="py-1.5 pr-3 font-medium">Variable</th>
                      <th className="py-1.5 pr-3 font-medium">Maps To</th>
                      <th className="py-1.5 pr-3 font-medium">Description</th>
                      <th className="py-1.5 font-medium">Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.vars.map((v) => (
                      <tr key={v.key} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => handleClick(v.key)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-xs border transition-all ${
                              copied === v.key
                                ? "bg-green-50 text-green-700 border-green-300"
                                : `${group.color} hover:opacity-80 cursor-pointer`
                            }`}
                          >
                            {`{{${v.key}}}`}
                            {copied === v.key && <span>&#10003;</span>}
                          </button>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-violet-600">{v.column}</td>
                        <td className="py-2 pr-3 text-slate-600">{v.desc}</td>
                        <td className="py-2 text-slate-400 italic">{v.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Custom fields */}
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Custom Fields
            </h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5">
              <p className="text-amber-800">
                Use <code className="font-mono bg-amber-100 px-1 rounded">{"{{custom.field_name}}"}</code> to
                pull any key from the contact&apos;s <code className="font-mono bg-amber-100 px-1 rounded">custom_fields</code> JSON.
              </p>
              <p className="text-amber-700">
                The field name is case-sensitive and must match exactly what&apos;s stored on the contact record.
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
            <p className="font-medium">Variables that don&apos;t exist render as blank text (no error).</p>
            <p>Always use the exact names from this list. Common mistakes:</p>
            <div className="mt-1 font-mono space-y-0.5 text-red-600">
              <p>&#10007; {"{{company_name}}"} &rarr; &#10003; {"{{company}}"}</p>
              <p>&#10007; {"{{name}}"} &rarr; &#10003; {"{{first_name}}"}</p>
              <p>&#10007; {"{{First_Name}}"} &rarr; &#10003; {"{{first_name}}"}</p>
              <p>&#10007; {"{{job_title}}"} &rarr; &#10003; {"{{title}}"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
