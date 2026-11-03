-- Server-only access. No anonymous/authenticated table or bucket access.
create table if not exists public.trippie_records (
 kind text not null, id text not null, mode text not null check (mode in ('live','demo')),
 generation integer not null default 0, payload jsonb not null, updated_at timestamptz not null default now(),
 primary key(kind,id)
);
create index if not exists trippie_records_mode on public.trippie_records(mode,kind);
alter table public.trippie_records enable row level security;
revoke all on public.trippie_records from anon,authenticated;
grant all on public.trippie_records to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('trippie-evidence','trippie-evidence',false,4194304,array['image/jpeg','image/png','application/json']) on conflict(id) do nothing;
create or replace function public.trippie_generation_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare current_generation integer;
begin
 if tg_op='UPDATE' and old.mode<>new.mode then raise exception 'Cannot move records between workspaces'; end if;
 if new.kind='workspace' then return new; end if;
 perform pg_advisory_xact_lock(hashtext('trippie-workspace-'||new.mode));
 select generation into current_generation from public.trippie_records where kind='workspace' and id=new.mode;
 if new.generation<>coalesce(current_generation,0) then raise exception 'Workspace generation expired'; end if;
 return new;
end $$;
drop trigger if exists trippie_generation_guard on public.trippie_records;
create trigger trippie_generation_guard before insert or update on public.trippie_records for each row execute function public.trippie_generation_guard();
create or replace function public.trippie_claim_job(job_id text,lease_token text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job jsonb; now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
 perform pg_advisory_xact_lock(hashtext('trippie-job-queue'));
 select payload into job from public.trippie_records where kind='job' and id=job_id for update;
 if job is null or job->>'state' not in ('queued','running') then return null; end if;
 if job->>'state'='running' and coalesce((job->>'leaseUntil')::bigint,0)>now_ms then return null; end if;
 if exists(select 1 from public.trippie_records r where kind='job' and id<>job_id and mode=job->>'mode' and payload->>'trippieId'=job->>'trippieId' and payload->>'state'='running' and (payload->>'leaseUntil')::bigint>now_ms) then return null; end if;
 job:=job||jsonb_build_object('state','running','leaseToken',lease_token,'leaseUntil',now_ms+240000,'attempts',coalesce((job->>'attempts')::int,0)+1);
 update public.trippie_records set payload=job,updated_at=now() where kind='job' and id=job_id;
 return job;
end $$;
create or replace function public.trippie_clear_demo() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare next_generation integer; n integer; assets jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('trippie-workspace-demo'));
 select coalesce(max(generation),0)+1 into next_generation from public.trippie_records where mode='demo';
 select coalesce(jsonb_agg(jsonb_build_object('key',payload->>'key')),'[]'::jsonb) into assets from public.trippie_records where kind='asset' and mode='demo';
 delete from public.trippie_records where mode='demo'; get diagnostics n=row_count;
 insert into public.trippie_records values('workspace','demo','demo',next_generation,jsonb_build_object('id','demo','mode','demo','generation',next_generation),now());
 return jsonb_build_object('generation',next_generation,'deletedRecords',n,'assets',assets);
end $$;
revoke all on function public.trippie_claim_job(text,text) from public,anon,authenticated;
revoke all on function public.trippie_clear_demo() from public,anon,authenticated;
grant execute on function public.trippie_claim_job(text,text) to service_role;
grant execute on function public.trippie_clear_demo() to service_role;
