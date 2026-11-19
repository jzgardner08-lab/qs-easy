create table public.qs_projects (
  id text primary key,
  owner_id uuid not null references auth.users(id),
  editors text[] not null default '{}',
  revision integer not null default 1,
  project jsonb not null check (project->>'id' = id)
);
alter table public.qs_projects enable row level security;
revoke all on public.qs_projects from anon, authenticated;
grant select, insert, update on public.qs_projects to authenticated;
create policy qs_read on public.qs_projects for select to authenticated using
  (owner_id=auth.uid() or lower(auth.jwt()->>'email')=any(editors));
create policy qs_create on public.qs_projects for insert to authenticated with check
  (owner_id=auth.uid() and revision=1);
create policy qs_edit on public.qs_projects for update to authenticated using
  (owner_id=auth.uid() or lower(auth.jwt()->>'email')=any(editors)) with check
  (owner_id=auth.uid() or lower(auth.jwt()->>'email')=any(editors));
create function public.qs_check_update() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id <> old.id or new.owner_id <> old.owner_id or new.revision <> old.revision+1 then
    raise exception 'Invalid project update';
  end if;
  if new.editors is distinct from old.editors and old.owner_id <> auth.uid() then
    raise exception 'Only the owner can change access';
  end if;
  return new;
end $$;
create trigger qs_update before update on public.qs_projects for each row execute function public.qs_check_update();
