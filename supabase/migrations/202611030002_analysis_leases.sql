-- Serialize claim/reset/publication in the same workspace-lock order.
create or replace function public.trippie_claim_job(job_id text,lease_token text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job jsonb; now_ms bigint;
begin
 perform pg_advisory_xact_lock(hashtext('trippie-job-queue'));
 select payload into job from public.trippie_records where kind='job' and id=job_id;
 if job is null then return null; end if;
 perform pg_advisory_xact_lock(hashtext('trippie-workspace-'||(job->>'mode')));
 select payload into job from public.trippie_records where kind='job' and id=job_id for update;
 now_ms:=floor(extract(epoch from clock_timestamp())*1000);
 if job is null or job->>'state' not in ('queued','running') then return null; end if;
 if job->>'state'='running' and coalesce((job->>'leaseUntil')::bigint,0)>now_ms then return null; end if;
 if exists(select 1 from public.trippie_records r where kind='job' and id<>job_id and mode=job->>'mode' and payload->>'trippieId'=job->>'trippieId' and payload->>'state'='running' and (payload->>'leaseUntil')::bigint>now_ms) then return null; end if;
 job:=job||jsonb_build_object('state','running','leaseToken',lease_token,'leaseUntil',now_ms+240000,'attempts',coalesce((job->>'attempts')::int,0)+1);
 update public.trippie_records set payload=job,updated_at=now() where kind='job' and id=job_id;
 return job;
end $$;
create or replace function public.trippie_write_analysis(analysis_job_id text,expected_token text,record_kind text,record_payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job jsonb; current_generation integer; now_ms bigint;
begin
 if record_kind not in ('job','observation','case') then raise exception 'Invalid analysis record kind'; end if;
 select payload into job from public.trippie_records where kind='job' and id=analysis_job_id;
 if job is null then raise exception 'Analysis job missing'; end if;
 perform pg_advisory_xact_lock(hashtext('trippie-workspace-'||(job->>'mode')));
 select payload into job from public.trippie_records where kind='job' and id=analysis_job_id for update;
 now_ms:=floor(extract(epoch from clock_timestamp())*1000);
 select generation into current_generation from public.trippie_records where kind='workspace' and id=job->>'mode';
 if job is null or job->>'state'<>'running' or job->>'leaseToken' is distinct from expected_token or coalesce((job->>'leaseUntil')::bigint,0)<=now_ms or (job->>'generation')::int<>coalesce(current_generation,0) then raise exception 'Analysis lease expired'; end if;
 if record_payload->>'mode' is distinct from job->>'mode' or (record_payload->>'generation')::int is distinct from (job->>'generation')::int then raise exception 'Analysis workspace mismatch'; end if;
 if record_kind='job' and record_payload->>'id'<>analysis_job_id then raise exception 'Analysis job mismatch'; end if;
 insert into public.trippie_records(kind,id,mode,generation,payload,updated_at) values(record_kind,record_payload->>'id',record_payload->>'mode',(record_payload->>'generation')::int,record_payload,now())
 on conflict(kind,id) do update set mode=excluded.mode,generation=excluded.generation,payload=excluded.payload,updated_at=excluded.updated_at;
 return record_payload;
end $$;
revoke all on function public.trippie_write_analysis(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trippie_write_analysis(text,text,text,jsonb) to service_role;
