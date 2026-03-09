'use client';
// app/auth/login/page.tsx — Supabase Auth login
import { useState } from 'react';
import { createBrowserClient } from '@/lib/db/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push('/dashboard/today');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold mb-6">Sign in to CleanOps</h1>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm" />
          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          No account? <a href="/signup" className="text-blue-600 underline">Sign up</a>
        </p>
      </div>
    </div>
  );
}
