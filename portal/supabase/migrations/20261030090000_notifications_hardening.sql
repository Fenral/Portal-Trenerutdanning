-- Hardening av varsel-outbox: hendelser som ble claimet ('processing') men
-- aldri fullført (worker-krasj, timeout) skal re-claimes etter et reaper-vindu
-- i stedet for å bli liggende for alltid uten incident.

alter table public.outbox_events
  add column claimed_at timestamptz;

create or replace function public.claim_notification_events(
  target_event_types text[],
  batch_size integer default 20,
  claim_now timestamptz default now()
)
returns setof public.outbox_events
language sql
security definer
set search_path = ''
as $$
  with claimable as (
    select event.id
    from public.outbox_events as event
    where event.event_type = any(target_event_types)
      and (
        (event.status = 'pending' and event.available_at <= claim_now)
        or (
          -- Reaper: et claim eldre enn 10 minutter regnes som krasjet worker.
          -- Verdt å vite: attempts teller videre, så fail-RPC-ens 5-grense
          -- og incident-oppretting gjelder også re-claimede hendelser.
          event.status = 'processing'
          and coalesce(event.claimed_at, event.created_at)
            <= claim_now - interval '10 minutes'
        )
      )
    order by event.available_at, event.created_at
    limit greatest(batch_size, 0)
    for update skip locked
  )
  update public.outbox_events as event
  set
    status = 'processing',
    attempts = event.attempts + 1,
    claimed_at = claim_now
  from claimable
  where event.id = claimable.id
  returning event.*;
$$;
