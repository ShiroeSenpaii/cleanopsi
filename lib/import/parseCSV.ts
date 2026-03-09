// lib/import/parseCSV.ts
// Parses a CSV file, validates rows, deduplicates within the batch,
// then writes customers/routes/subscriptions to the database.

import Papa from 'papaparse';
import { createServiceClient } from '@/lib/db/client';
import { validateRow, ImportRow, RawCSVRow } from './validateRow';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ rowIndex: number; field: string; message: string }>;
}

export async function parseAndImportCSV(
  csvText: string,
  organisationId: string,
): Promise<ImportResult> {
  const supabase = createServiceClient();
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  const parsed = Papa.parse<RawCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const rows = parsed.data;

  // Step 1: validate all rows
  const validRows: Array<{ rowIndex: number; data: ImportRow }> = [];

  for (let i = 0; i < rows.length; i++) {
    const validation = validateRow(rows[i], i + 2);
    if (!validation.ok) {
      for (const err of validation.errors) {
        result.errors.push({ rowIndex: validation.rowIndex, ...err });
      }
      result.skipped++;
    } else {
      validRows.push({ rowIndex: i + 2, data: validation.data });
    }
  }

  // Step 2: deduplicate within batch
  const seenInBatch = new Map<string, number>();
  const deduplicatedRows: Array<{ rowIndex: number; data: ImportRow }> = [];

  for (const row of validRows) {
    const key = `${row.data.phoneE164}|${row.data.weekday}|${row.data.frequency}`;
    if (seenInBatch.has(key)) {
      result.errors.push({
        rowIndex: row.rowIndex,
        field: 'phone_e164',
        message: `Duplicate row in import: same phone, weekday, and frequency as row ${seenInBatch.get(key)}.`,
      });
      result.skipped++;
    } else {
      seenInBatch.set(key, row.rowIndex);
      deduplicatedRows.push(row);
    }
  }

  // Step 3: write to DB
  for (const { rowIndex, data } of deduplicatedRows) {
    try {
      await importSingleRow(supabase, organisationId, data);
      result.imported++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ rowIndex, field: 'db', message });
      result.skipped++;
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importSingleRow(supabase: any, organisationId: string, data: ImportRow): Promise<void> {
  // 1. Upsert customer
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .upsert(
      {
        organisation_id: organisationId,
        phone_e164: data.phoneE164,
        name: data.customerName,
        notes: data.notes,
        consent_status: data.consentStatus,
        consent_source: 'csv_import',
      },
      { onConflict: 'organisation_id,phone_e164', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (custErr) throw new Error(`Customer upsert failed: ${custErr.message}`);

  // 2. Find or create route
  let routeId: string;

  const routeQuery = supabase
    .from('routes')
    .select('id')
    .eq('organisation_id', organisationId)
    .eq('weekday', data.weekday);

  const routeQueryFinal = data.isAnytime
    ? routeQuery.is('window_start', null).is('window_end', null)
    : routeQuery.eq('window_start', data.windowStart).eq('window_end', data.windowEnd);

  const { data: existingRoute } = await routeQueryFinal.maybeSingle();

  if (existingRoute) {
    routeId = existingRoute.id;
  } else {
    const { data: newRoute, error: routeErr } = await supabase
      .from('routes')
      .insert({
        organisation_id: organisationId,
        name: data.routeName,
        weekday: data.weekday,
        window_start: data.windowStart,
        window_end: data.windowEnd,
        window_label: data.windowLabel,
      })
      .select('id')
      .single();

    if (routeErr) throw new Error(`Route insert failed: ${routeErr.message}`);
    routeId = newRoute.id;
  }

  // 3. Compute next_visit_date
  const nextVisitDate = data.nextVisitDate ?? computeNextOccurrence(data.weekday);

  // 4. Upsert subscription
  const { error: subErr } = await supabase.from('subscriptions').upsert(
    {
      organisation_id: organisationId,
      customer_id: customer.id,
      route_id: routeId,
      frequency: data.frequency,
      next_visit_date: nextVisitDate,
      active: true,
    },
    {
      onConflict: 'organisation_id,customer_id,route_id,frequency',
      ignoreDuplicates: true,
    },
  );

  if (subErr) throw new Error(`Subscription upsert failed: ${subErr.message}`);
}

function computeNextOccurrence(targetWeekday: number): string {
  const today = new Date();
  const todayWeekday = today.getDay();
  let daysAhead = targetWeekday - todayWeekday;
  if (daysAhead <= 0) daysAhead += 7;
  const result = new Date(today);
  result.setDate(today.getDate() + daysAhead);
  return result.toISOString().split('T')[0];
}
