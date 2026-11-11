-- No revoca el Pro ya concedido a los 50 primeros ni a early_access.
drop function if exists public.grant_first_fifty_if_eligible(uuid);
drop table if exists public.stripe_webhook_events;
-- La restricción de source puede seguir admitiendo first_fifty.
