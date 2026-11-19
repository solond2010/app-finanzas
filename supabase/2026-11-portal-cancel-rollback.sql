-- Quita la marca de cancelación a fin de periodo. No toca el resto del plan.

alter table public.user_plans
  drop column if exists cancel_at_period_end;
