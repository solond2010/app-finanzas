drop function if exists public.submit_demo_feedback(text, text, text, text);
delete from public.feedback where user_id is null;
alter table public.feedback alter column user_id set not null;
