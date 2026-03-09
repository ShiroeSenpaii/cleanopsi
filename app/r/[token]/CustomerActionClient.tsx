'use client';
// app/r/[token]/CustomerActionClient.tsx

import { useState } from 'react';
import type { RescheduleSlot } from '@/lib/scheduler/rescheduleSlots';

interface Props {
  token: string;
  visitDate: string;
  windowLabel: string;
  customerName: string;
  businessName: string;
  confirmStatus: string;
  visitStatus: string;
  alreadyActioned: boolean;
  rescheduleSlots: RescheduleSlot[];
  orgTz: string;
}

type Screen = 'main' | 'reschedule' | 'done' | 'error';

export default function CustomerActionClient({
  token, visitDate, windowLabel, customerName, businessName,
  confirmStatus, visitStatus, alreadyActioned, rescheduleSlots,
}: Props) {
  const [screen, setScreen] = useState<Screen>(alreadyActioned ? 'done' : 'main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visitDisplayDate = new Date(visitDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  async function handleAction(action: 'confirm' | 'skip') {
    setLoading(true);
    try {
      const res = await fetch(`/api/r/${token}/${action}`, { method: 'POST' });
      if (res.ok) {
        setMessage(action === 'confirm' ? 'Got it — your visit is confirmed!' : 'No problem — your visit has been skipped.');
        setScreen('done');
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? 'Something went wrong. Please try again.');
        setScreen('error');
      }
    } catch {
      setMessage('Network error. Please try again.');
      setScreen('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReschedule(slot: RescheduleSlot) {
    setLoading(true);
    try {
      const res = await fetch(`/api/r/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_start: slot.slotStart, slot_end: slot.slotEnd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 202) {
        setMessage(data.partialSuccess ? data.message : `Rescheduled to ${slot.displayLabel}.`);
        setScreen('done');
      } else {
        setMessage(data.error ?? 'Could not reschedule. Please try again.');
        setScreen('error');
      }
    } catch {
      setMessage('Network error. Please try again.');
      setScreen('error');
    } finally {
      setLoading(false);
    }
  }

  if (screen === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-semibold mb-2">{businessName}</h1>
          <p className="text-gray-600">
            {message ?? (
              confirmStatus === 'confirmed' ? 'This visit is confirmed.' :
              confirmStatus === 'rescheduled' ? 'This visit has been rescheduled.' :
              visitStatus === 'skipped' ? 'This visit has been skipped.' : ''
            )}
          </p>
        </div>
      </div>
    );
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-2">{businessName}</h1>
          <p className="text-gray-600 mb-4">{message}</p>
          <button onClick={() => setScreen('main')} className="text-sm text-blue-600 underline">Try again</button>
        </div>
      </div>
    );
  }

  if (screen === 'reschedule') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8">
          <h1 className="text-xl font-semibold mb-1">{businessName}</h1>
          <p className="text-gray-500 text-sm mb-6">Choose a new time for your visit</p>
          {rescheduleSlots.length === 0 ? (
            <p className="text-gray-500 text-sm">No available slots right now. Please contact us directly.</p>
          ) : (
            <div className="space-y-3">
              {rescheduleSlots.map((slot) => (
                <button
                  key={slot.slotStart}
                  onClick={() => handleReschedule(slot)}
                  disabled={loading}
                  className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition"
                >
                  <span className="font-medium text-gray-800">{slot.displayLabel}</span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setScreen('main')} className="mt-6 text-sm text-gray-400 underline w-full text-center">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8">
        <h1 className="text-xl font-semibold mb-1">{businessName}</h1>
        <p className="text-gray-500 text-sm mb-1">Hi {customerName},</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-gray-800 font-medium">{visitDisplayDate}</p>
          <p className="text-gray-500 text-sm">{windowLabel}</p>
        </div>
        {alreadyActioned ? (
          <p className="text-gray-500 text-sm text-center">
            {confirmStatus === 'confirmed' && 'This visit is confirmed.'}
            {confirmStatus === 'rescheduled' && 'This visit has been rescheduled.'}
            {visitStatus === 'skipped' && 'This visit has been skipped.'}
          </p>
        ) : (
          <div className="space-y-3">
            <button onClick={() => handleAction('confirm')} disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl py-4 text-lg transition">
              ✅ Confirm visit
            </button>
            <button onClick={() => handleAction('skip')} disabled={loading}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl py-4 transition">
              ⏭ Skip this visit
            </button>
            <button onClick={() => setScreen('reschedule')} disabled={loading}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl py-4 transition">
              🔁 Reschedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
