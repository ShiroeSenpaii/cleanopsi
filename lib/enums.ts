// lib/enums.ts
// Single source of truth for all shared enums.
// Keep in sync with database CHECK constraints.

export const VisitStatus = {
  SCHEDULED: 'scheduled',
  SKIPPED: 'skipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus];

export const ConfirmStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  RESCHEDULE_REQUESTED: 'reschedule_requested',
  RESCHEDULED: 'rescheduled',
  NO_RESPONSE: 'no_response',
} as const;
export type ConfirmStatus = (typeof ConfirmStatus)[keyof typeof ConfirmStatus];

export const MessageStatus = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  UNDELIVERED: 'undelivered',
  FAILED: 'failed',
  INBOUND_RECEIVED: 'inbound_received',
  SUPPRESSED: 'suppressed',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const MessageDirection = {
  OUTBOUND: 'outbound',
  INBOUND: 'inbound',
} as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];

export const MessageTemplateKey = {
  REMINDER_24H: 'reminder_24h',
  REMINDER_2H: 'reminder_2h',
  RESCHEDULE_CONFIRMED: 'reschedule_confirmed',
  HELP_REPLY: 'help_reply',
} as const;
export type MessageTemplateKey = (typeof MessageTemplateKey)[keyof typeof MessageTemplateKey];

export const Frequency = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
} as const;
export type Frequency = (typeof Frequency)[keyof typeof Frequency];

export const ConsentStatus = {
  OPTED_IN: 'opted_in',
  OPTED_OUT: 'opted_out',
  UNKNOWN: 'unknown',
} as const;
export type ConsentStatus = (typeof ConsentStatus)[keyof typeof ConsentStatus];

export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const RescheduleRequestState = {
  OPENED: 'opened',
  SELECTED: 'selected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
export type RescheduleRequestState =
  (typeof RescheduleRequestState)[keyof typeof RescheduleRequestState];

export const SuppressionReason = {
  STOP_KEYWORD: 'stop_keyword',
  STOP_LIKE_PHRASE: 'stop_like_phrase',
  MANUAL: 'manual',
  COMPLAINT: 'complaint',
} as const;
export type SuppressionReason =
  (typeof SuppressionReason)[keyof typeof SuppressionReason];

export const OnboardingStep = {
  SMS: 'sms',
  CALENDAR: 'calendar',
  IMPORT: 'import',
  COMPLETE: 'complete',
} as const;
export type OnboardingStep = (typeof OnboardingStep)[keyof typeof OnboardingStep];
