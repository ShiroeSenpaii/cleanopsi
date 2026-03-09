// app/api/customers/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { parseAndImportCSV } from '@/lib/import/parseCSV';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data: orgUser } = await supabase
    .from('users')
    .select('organisation_id')
    .eq('id', user.id)
    .single();

  if (!orgUser?.organisation_id) return NextResponse.json({ error: 'Organisation not found' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const csvText = await file.text();
  const result = await parseAndImportCSV(csvText, orgUser.organisation_id);
  return NextResponse.json(result);
}
