'use client';
// app/(app)/onboarding/sms/page.tsx
import { useState } from 'react';

export default function OnboardingSMS() {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [messagingServiceSid, setMessagingServiceSid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setLoading(true); setError(null);
    const res = await fetch('/api/onboarding/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountSid, authToken, fromNumber: fromNumber || null, messagingServiceSid: messagingServiceSid || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setLoading(false); return; }
    setDone(true);
    window.location.href = '/onboarding/calendar';
  }

  if (done) return <div className="p-8 text-center text-green-600 font-medium">Twilio connected! Redirecting…</div>;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Connect Twilio</h1>
      <p className="text-gray-500 text-sm mb-6">Enter your Twilio credentials. These are stored encrypted.</p>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Account SID</label>
          <input value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxx"
            className="w-full border rounded-xl px-4 py-3 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Auth Token</label>
          <input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="your_auth_token"
            className="w-full border rounded-xl px-4 py-3 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">From Number (or Messaging Service SID)</label>
          <input value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} placeholder="+12025550100"
            className="w-full border rounded-xl px-4 py-3 text-sm font-mono" />
          <p className="text-xs text-gray-400 mt-1">Or use a Messaging Service SID below instead.</p>
          <input value={messagingServiceSid} onChange={(e) => setMessagingServiceSid(e.target.value)} placeholder="MGxxxxxxxxxxxxxxxx (optional)"
            className="w-full border rounded-xl px-4 py-3 text-sm font-mono mt-2" />
        </div>
        <p className="text-xs text-gray-500">All customers must be able to reply STOP to opt out. This is handled automatically.</p>
        <button onClick={handleSave} disabled={loading || !accountSid || !authToken}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      </div>
    </div>
  );
}
