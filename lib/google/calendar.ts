// lib/google/calendar.ts
// Google Calendar API wrapper. Never swallows errors — callers handle failures.

import { google } from 'googleapis';
import { createServiceClient } from '@/lib/db/client';
import { decrypt, encrypt } from '@/lib/crypto';

async function getOAuth2Client(organisationId: string) {
  const supabase = createServiceClient();

  const { data: integ, error } = await supabase
    .from('integrations_google')
    .select('refresh_token_enc, access_token_enc, token_expires_at')
    .eq('organisation_id', organisationId)
    .single();

  if (error || !integ) throw new Error(`Google Calendar not configured for org: ${organisationId}`);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const refreshToken = decrypt(integ.refresh_token_enc);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const now = Date.now();
  const expiresAt = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0;

  if (!integ.access_token_enc || now >= expiresAt - 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    await supabase
      .from('integrations_google')
      .update({
        access_token_enc: credentials.access_token ? encrypt(credentials.access_token) : null,
        token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
      })
      .eq('organisation_id', organisationId);
  } else {
    oauth2Client.setCredentials({ refresh_token: refreshToken, access_token: decrypt(integ.access_token_enc) });
  }

  return oauth2Client;
}

async function getCalendarId(organisationId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('integrations_google')
    .select('calendar_id')
    .eq('organisation_id', organisationId)
    .single();

  if (!data?.calendar_id) throw new Error(`No Google Calendar selected for org: ${organisationId}`);
  return data.calendar_id;
}

export async function listCalendars(organisationId: string): Promise<Array<{ id: string; summary: string }>> {
  const auth = await getOAuth2Client(organisationId);
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.calendarList.list();
  return (res.data.items ?? []).map((c) => ({ id: c.id ?? '', summary: c.summary ?? '' }));
}

interface CalendarEventParams {
  organisationId: string;
  visitId: string;
  customerName: string;
  slotStart: string;
  slotEnd: string | null;
  existingEventId: string | null;
  isAnytime: boolean;
}

/**
 * Create or update a Google Calendar event. Returns the Google event ID.
 * Throws on any error — caller must handle and surface to owner.
 */
export async function createOrUpdateCalendarEvent(params: CalendarEventParams): Promise<string> {
  const { organisationId, customerName, slotStart, slotEnd, existingEventId, isAnytime } = params;

  const auth = await getOAuth2Client(organisationId);
  const calendarId = await getCalendarId(organisationId);
  const calendar = google.calendar({ version: 'v3', auth });

  const eventBody = isAnytime
    ? { summary: `Service – ${customerName}`, start: { date: slotStart.split('T')[0] }, end: { date: slotStart.split('T')[0] } }
    : { summary: `Service – ${customerName}`, start: { dateTime: slotStart }, end: { dateTime: slotEnd ?? slotStart } };

  if (existingEventId) {
    const res = await calendar.events.update({ calendarId, eventId: existingEventId, requestBody: eventBody });
    return res.data.id!;
  } else {
    const res = await calendar.events.insert({ calendarId, requestBody: eventBody });
    return res.data.id!;
  }
}
