'use client';
// app/(app)/onboarding/import/page.tsx
import { useState } from 'react';

export default function OnboardingImport() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { rowIndex: number; field: string; message: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/customers/import', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Import customers</h1>
      <p className="text-gray-500 text-sm mb-2">Upload a CSV with columns: customer_name, phone_e164, route_name, weekday, window_label, window_start, window_end, frequency</p>
      <p className="text-xs text-gray-400 mb-6">Frequency must be: weekly, biweekly, or monthly. Phone must be E.164 format (+12025550101).</p>

      <div className="space-y-4">
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />

        <button onClick={handleImport} disabled={!file || loading}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? 'Importing…' : 'Import CSV'}
        </button>
      </div>

      {result && (
        <div className="mt-6 space-y-3">
          <div className="flex gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex-1 text-center">
              <p className="text-2xl font-bold text-green-700">{result.imported}</p>
              <p className="text-sm text-green-600">Imported</p>
            </div>
            <div className="bg-gray-50 border rounded-xl p-4 flex-1 text-center">
              <p className="text-2xl font-bold text-gray-700">{result.skipped}</p>
              <p className="text-sm text-gray-500">Skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-medium text-red-700 mb-2">Row errors:</p>
              <ul className="text-sm text-red-600 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>Row {e.rowIndex}: [{e.field}] {e.message}</li>
                ))}
              </ul>
            </div>
          )}
          {result.imported > 0 && (
            <a href="/visits/generate" className="block w-full bg-green-600 text-white rounded-xl py-3 text-center font-medium hover:bg-green-700 transition">
              Generate visits →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
