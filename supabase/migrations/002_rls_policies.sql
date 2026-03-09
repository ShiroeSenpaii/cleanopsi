-- supabase/migrations/002_rls_policies.sql

create or replace function auth_org_id()
returns uuid language sql security definer stable as $$
  select organisation_id from users where id = auth.uid()
$$;

alter table organisations         enable row level security;
alter table users                 enable row level security;
alter table customers             enable row level security;
alter table routes                enable row level security;
alter table subscriptions         enable row level security;
alter table visits                enable row level security;
alter table reschedule_requests   enable row level security;
alter table message_templates     enable row level security;
alter table messages              enable row level security;
alter table suppression_list      enable row level security;
alter table integrations_twilio   enable row level security;
alter table integrations_google   enable row level security;
alter table visit_action_tokens   enable row level security;

create policy "org: own only"           on organisations         for all using (id = auth_org_id());
create policy "users: own org"          on users                 for all using (organisation_id = auth_org_id());
create policy "customers: own org"      on customers             for all using (organisation_id = auth_org_id());
create policy "routes: own org"         on routes                for all using (organisation_id = auth_org_id());
create policy "subscriptions: own org"  on subscriptions         for all using (organisation_id = auth_org_id());
create policy "visits: own org"         on visits                for all using (organisation_id = auth_org_id());
create policy "reschedule: own org"     on reschedule_requests   for all using (organisation_id = auth_org_id());
create policy "templates: own org"      on message_templates     for all using (organisation_id = auth_org_id());
create policy "messages: own org"       on messages              for all using (organisation_id = auth_org_id());
create policy "suppression: own org"    on suppression_list      for all using (organisation_id = auth_org_id());
create policy "twilio_integ: own org"   on integrations_twilio   for all using (organisation_id = auth_org_id());
create policy "google_integ: own org"   on integrations_google   for all using (organisation_id = auth_org_id());
create policy "tokens: own org"         on visit_action_tokens   for all using (organisation_id = auth_org_id());
