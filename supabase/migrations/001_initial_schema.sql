-- supabase/migrations/001_initial_schema.sql
-- Initial schema for Recurring-Service Confirm & Auto-Reschedule Bot

create extension if not exists "pgcrypto";

-- ENUMS
create type visit_status as enum ('scheduled', 'skipped', 'completed', 'cancelled');
create type confirm_status as enum ('pending', 'confirmed', 'reschedule_requested', 'rescheduled', 'no_response');
create type message_status as enum ('queued', 'sent', 'delivered', 'undelivered', 'failed', 'inbound_received', 'suppressed');
create type message_direction as enum ('outbound', 'inbound');
create type message_template_key as enum ('reminder_24h', 'reminder_2h', 'reschedule_confirmed', 'help_reply');
create type frequency_type as enum ('weekly', 'biweekly', 'monthly');
create type consent_status as enum ('opted_in', 'opted_out', 'unknown');
create type user_role as enum ('owner', 'admin');
create type reschedule_request_state as enum ('opened', 'selected', 'expired', 'cancelled');
create type suppression_reason as enum ('stop_keyword', 'stop_like_phrase', 'manual', 'complaint');
create type onboarding_step as enum ('sms', 'calendar', 'import', 'complete');

-- ORGANISATIONS
create table organisations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  tz                 text not null default 'America/New_York',
  support_email      text,
  support_phone      text,
  onboarding_step    onboarding_step not null default 'sms',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- USERS
create table users (
  id                 uuid primary key,
  organisation_id    uuid not null references organisations(id) on delete cascade,
  role               user_role not null default 'owner',
  created_at         timestamptz not null default now()
);

-- CUSTOMERS
create table customers (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references organisations(id) on delete cascade,
  name               text,
  phone_e164         text not null,
  notes              text,
  consent_status     consent_status not null default 'unknown',
  consent_at         timestamptz,
  consent_source     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organisation_id, phone_e164)
);

-- ROUTES
create table routes (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references organisations(id) on delete cascade,
  name                text not null,
  weekday             smallint not null check (weekday between 0 and 6),
  window_start        time,
  window_end          time,
  window_label        text,
  is_anytime          boolean not null generated always as (window_start is null) stored,
  reminder_rule_json  jsonb not null default '{"reminder_24h_time": "18:00"}',
  created_at          timestamptz not null default now(),
  unique (organisation_id, name, weekday, window_start, window_end)
);

-- SUBSCRIPTIONS
create table subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references organisations(id) on delete cascade,
  customer_id        uuid not null references customers(id) on delete cascade,
  route_id           uuid not null references routes(id),
  frequency          frequency_type not null,
  next_visit_date    date not null,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organisation_id, customer_id, route_id, frequency)
);

-- VISITS
create table visits (
  id                      uuid primary key default gen_random_uuid(),
  organisation_id         uuid not null references organisations(id) on delete cascade,
  subscription_id         uuid not null references subscriptions(id) on delete cascade,
  scheduled_date          date not null,
  scheduled_start         timestamptz,
  scheduled_end           timestamptz,
  status                  visit_status not null default 'scheduled',
  confirm_status          confirm_status not null default 'pending',
  google_event_id         text,
  calendar_sync_error     text,
  last_customer_action_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (subscription_id, scheduled_date)
);

-- RESCHEDULE REQUESTS
create table reschedule_requests (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  visit_id             uuid not null references visits(id) on delete cascade,
  customer_id          uuid not null references customers(id),
  state                reschedule_request_state not null default 'opened',
  selected_slot_start  timestamptz,
  selected_slot_end    timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- MESSAGE TEMPLATES
create table message_templates (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references organisations(id) on delete cascade,
  key                message_template_key not null,
  body               text not null,
  enabled            boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organisation_id, key)
);

-- MESSAGES
create table messages (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references organisations(id) on delete cascade,
  visit_id              uuid references visits(id),
  template_key          message_template_key,
  direction             message_direction not null,
  to_e164               text not null,
  from_e164             text,
  body                  text not null,
  twilio_message_sid    text,
  status                message_status not null,
  error_code            integer,
  suppression_triggered boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_messages_twilio_sid on messages(twilio_message_sid) where twilio_message_sid is not null;
create index idx_messages_visit_template on messages(visit_id, template_key) where visit_id is not null;

-- SUPPRESSION LIST
create table suppression_list (
  organisation_id    uuid not null references organisations(id) on delete cascade,
  phone_e164         text not null,
  suppressed_at      timestamptz not null default now(),
  reason             suppression_reason not null,
  raw_body           text,
  primary key (organisation_id, phone_e164)
);

-- INTEGRATIONS: TWILIO
create table integrations_twilio (
  organisation_id         uuid primary key references organisations(id) on delete cascade,
  account_sid             text not null,
  auth_token_enc          text not null,
  messaging_service_sid   text,
  from_number             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (messaging_service_sid is not null or from_number is not null)
);

-- INTEGRATIONS: GOOGLE CALENDAR
create table integrations_google (
  organisation_id     uuid primary key references organisations(id) on delete cascade,
  refresh_token_enc   text not null,
  access_token_enc    text,
  token_expires_at    timestamptz,
  calendar_id         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- VISIT ACTION TOKENS
create table visit_action_tokens (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references organisations(id) on delete cascade,
  visit_id           uuid not null references visits(id) on delete cascade,
  token              text not null unique,
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now()
);

create index idx_action_tokens_token on visit_action_tokens(token);
create index idx_action_tokens_visit on visit_action_tokens(visit_id);

-- UNMATCHED WEBHOOK EVENTS
create table unmatched_webhook_events (
  id                 uuid primary key default gen_random_uuid(),
  twilio_message_sid text,
  payload_json       jsonb not null,
  received_at        timestamptz not null default now()
);

-- UPDATED_AT TRIGGER
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_organisations_updated_at before update on organisations for each row execute function set_updated_at();
create trigger trg_customers_updated_at before update on customers for each row execute function set_updated_at();
create trigger trg_subscriptions_updated_at before update on subscriptions for each row execute function set_updated_at();
create trigger trg_visits_updated_at before update on visits for each row execute function set_updated_at();
create trigger trg_reschedule_requests_updated_at before update on reschedule_requests for each row execute function set_updated_at();
create trigger trg_message_templates_updated_at before update on message_templates for each row execute function set_updated_at();
create trigger trg_messages_updated_at before update on messages for each row execute function set_updated_at();
