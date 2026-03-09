'use client';
// app/(app)/onboarding/calendar/page.tsx
export default function OnboardingCalendar() {
  function handleConnect() {
    window.location.href = '/api/auth/google';
  }
  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Connect Google Calendar</h1>
      <p className="text-gray-500 text-sm mb-6">Connect a Google account and choose a dedicated calendar for route visits.</p>
      <button onClick={handleConnect}
        className="w-full bg-white border-2 border-gray-200 rounded-xl py-3 font-medium hover:bg-gray-50 transition">
        🗓 Connect Google Calendar
      </button>
    </div>
  );
}
