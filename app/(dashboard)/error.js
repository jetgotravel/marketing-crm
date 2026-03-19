"use client";

export default function DashboardError({ error, reset }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 text-center">
      <p className="text-sm text-red-600">
        {error?.message || "Something went wrong"}
      </p>
      <button
        onClick={reset}
        className="mt-3 px-4 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
