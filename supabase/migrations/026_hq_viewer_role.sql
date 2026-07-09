alter type public.user_role add value if not exists 'hq_viewer';

drop policy if exists "HQ viewers can view schools" on public.schools;
create policy "HQ viewers can view schools"
on public.schools for select
using (public.current_profile_role()::text = 'hq_viewer');

drop policy if exists "HQ viewers can view students" on public.students;
create policy "HQ viewers can view students"
on public.students for select
using (public.current_profile_role()::text = 'hq_viewer');
