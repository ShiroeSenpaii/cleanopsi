'use client';
// app/(app)/onboarding/calendar/pick/page.tsx
// Lets user choose which Google Calendar to use for route visits.

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Calendar {
  id: string;
  summary: string;
}

export default function PickCalendarPage() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) { setError(`Google sign-in failed: ${oauthError}`); setLoading(false); return; }

    fetch('/api/onboarding/calendar/list')
      .then((r) => r.json())
      .then((data) => { setCalendars(data.calendars ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load calendars'); setLoading(false); });
  }, [searchParams]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch('/api/onboarding/calendar/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: selected }),
    });
    if (res.ok) {
      router.push('/onboarding/import');
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Choose a calendar</h1>
      <p className="text-gray-500 text-sm mb-6">Pick the Google Calendar where route visits will be created. We recommend a dedicated calendar.</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400">Loading your calendars…</p>
      ) : (
        <div className="space-y-2 mb-6">
          {calendars.map((cal) => (
            <label key={cal.id}
              className={`flex items-center gap-3 border rounded-xl p-4 cursor-pointer transition ${selected === cal.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
              <input type="radio" name="calendar" value={cal.id}
                checked={selected === cal.id} onChange={() => setSelected(cal.id)} />
              <span className="font-medium">{cal.summary}</span>
            </label>
          ))}
          {calendars.length === 0 && <p className="text-gray-400 text-sm">No calendars found on this account.</p>}
        </div>
      )}

      <button onClick={handleSave} disabled={!selected || saving}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition disabled:opacity-50">
        {saving ? 'Saving…' : 'Use this calendar →'}
      </button>
    </div>
  );
}
