-- Marcha atrás de 2026-11-objetivos-patrimonio.sql (borra los objetivos guardados).
begin;
drop table if exists public.wealth_goals;
drop function if exists public.wealth_goals_limit();
commit;
