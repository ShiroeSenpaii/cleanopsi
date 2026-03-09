// lib/templates/defaults.ts
// Default message template bodies inserted at org creation.
// All templates MUST contain "Reply STOP to opt out."
// {{variables}} are replaced at send time.

export const DEFAULT_TEMPLATES = {
  reminder_24h: {
    key: 'reminder_24h' as const,
    body: `Hi {{customer_name}}, this is a reminder that {{business_name}} has a visit scheduled for you tomorrow{{window_text}}.\n\nPlease let us know: {{action_url}}\n\nReply STOP to opt out.`,
    enabled: true,
  },
  reminder_2h: {
    key: 'reminder_2h' as const,
    body: `Hi {{customer_name}}, {{business_name}} is on the way for your {{window_text}} visit today.\n\nConfirm or make changes: {{action_url}}\n\nReply STOP to opt out.`,
    enabled: true,
  },
  reschedule_confirmed: {
    key: 'reschedule_confirmed' as const,
    body: `Hi {{customer_name}}, your visit with {{business_name}} has been rescheduled to {{new_date_text}}{{new_window_text}}. See you then!\n\nReply STOP to opt out.`,
    enabled: true,
  },
  help_reply: {
    key: 'help_reply' as const,
    body: `For help with your {{business_name}} service, please contact us at {{support_contact}}. Reply STOP to opt out.`,
    enabled: true,
  },
} as const;

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

/**
 * Replace {{variable}} placeholders in a template body.
 */
export function renderTemplate(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Validate that a template body still includes the required opt-out line.
 * Called before saving user-edited templates.
 */
export function validateTemplateBody(body: string): { valid: boolean; error?: string } {
  if (!body.toLowerCase().includes('reply stop to opt out')) {
    return {
      valid: false,
      error: 'Template must include "Reply STOP to opt out."',
    };
  }
  return { valid: true };
}
