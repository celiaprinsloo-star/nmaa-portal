update public.profiles
set
  role = null,
  approval_status = 'rejected',
  rejection_reason = coalesce(rejection_reason, 'Compliance officer role removed. Super and national admins manage compliance.'),
  updated_at = now()
where role::text = 'compliance_officer';

drop policy if exists "Compliance officer and scoped compliance document visibility" on public.compliance_documents;
create policy "Scoped compliance document visibility"
on public.compliance_documents for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or exists (
    select 1 from public.schools s
    where s.id = compliance_documents.school_id
    and s.province_id = public.current_profile_province_id()
    and public.current_profile_role() = 'provincial_admin'
  )
);

drop policy if exists "Compliance officer and scoped compliance submission visibility" on public.compliance_submissions;
create policy "Scoped compliance submission visibility"
on public.compliance_submissions for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or exists (
    select 1 from public.schools s
    where s.id = compliance_submissions.school_id
    and s.province_id = public.current_profile_province_id()
    and public.current_profile_role() = 'provincial_admin'
  )
);

drop policy if exists "National admins can manage order catalogue" on public.order_catalog_items;
drop policy if exists "Approved users can view active order catalogue" on public.order_catalog_items;

create policy "Approved users can view active order catalogue"
on public.order_catalog_items for select
using (active = true and public.current_profile_role() is not null);

create policy "National admins can manage order catalogue"
on public.order_catalog_items for all
using (public.is_national_admin())
with check (public.is_national_admin());

drop policy if exists "School owners can view own orders" on public.school_orders;
drop policy if exists "School owners can create own orders" on public.school_orders;
drop policy if exists "National admins can manage school orders" on public.school_orders;
drop policy if exists "School owners can view own order items" on public.school_order_items;
drop policy if exists "School owners can create own order items" on public.school_order_items;
drop policy if exists "National admins can manage school order items" on public.school_order_items;

create policy "School owners can view own orders"
on public.school_orders for select
using (
  public.is_national_admin()
  or (
    public.current_profile_role() = 'school_owner'
    and school_id = public.current_profile_school_id()
  )
);

create policy "School owners can create own orders"
on public.school_orders for insert
with check (
  public.current_profile_role() = 'school_owner'
  and school_id = public.current_profile_school_id()
);

create policy "National admins can manage school orders"
on public.school_orders for all
using (public.is_national_admin())
with check (public.is_national_admin());

create policy "School owners can view own order items"
on public.school_order_items for select
using (
  public.is_national_admin()
  or exists (
    select 1 from public.school_orders o
    where o.id = school_order_items.order_id
    and o.school_id = public.current_profile_school_id()
    and public.current_profile_role() = 'school_owner'
  )
);

create policy "School owners can create own order items"
on public.school_order_items for insert
with check (
  exists (
    select 1 from public.school_orders o
    where o.id = school_order_items.order_id
    and o.school_id = public.current_profile_school_id()
    and public.current_profile_role() = 'school_owner'
  )
);

create policy "National admins can manage school order items"
on public.school_order_items for all
using (public.is_national_admin())
with check (public.is_national_admin());
