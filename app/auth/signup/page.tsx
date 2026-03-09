'use client';
// app/auth/signup/page.tsx
import { useState } from 'react';
import { createBrowserClient } from '@/lib/db/client';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();

    const { data, error: signupErr } = await supabase.auth.signUp({ email, password });
    if (signupErr || !data.user) { setError(signupErr?.message ?? 'Signup failed'); setLoading(false); return; }

    // Create org + user record via API
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName }),
    });

    if (!res.ok) { setError('Account created but org setup failed. Please contact support.'); setLoading(false); return; }

    router.push('/onboarding/sms');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold mb-6">Create your CleanOps account</h1>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="space-y-4">
          <input type="text" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm" />
          <button onClick={handleSignup} disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          Have an account? <a href="/login" className="text-blue-600 underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
