-- Failed-to-queued retries are a conditional transition using the same lease identity.
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
 if job is null or (job->>'state'<>'running' and not (record_kind='job' and record_payload->>'id'=analysis_job_id and record_payload->>'state'='queued' and job->>'state'='failed')) or job->>'leaseToken' is distinct from expected_token or (coalesce((job->>'leaseUntil')::bigint,0)<=now_ms and not (record_kind='job' and record_payload->>'id'=analysis_job_id and record_payload->>'state'='queued' and job->>'state'='failed')) or (job->>'generation')::int<>coalesce(current_generation,0) then raise exception 'Analysis lease expired'; end if;
 if record_payload->>'mode' is distinct from job->>'mode' or (record_payload->>'generation')::int is distinct from (job->>'generation')::int then raise exception 'Analysis workspace mismatch'; end if;
 if record_kind='job' and record_payload->>'id'<>analysis_job_id then raise exception 'Analysis job mismatch'; end if;
 insert into public.trippie_records(kind,id,mode,generation,payload,updated_at) values(record_kind,record_payload->>'id',record_payload->>'mode',(record_payload->>'generation')::int,record_payload,now())
 on conflict(kind,id) do update set mode=excluded.mode,generation=excluded.generation,payload=excluded.payload,updated_at=excluded.updated_at;
 return record_payload;
end $$;
revoke all on function public.trippie_write_analysis(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trippie_write_analysis(text,text,text,jsonb) to service_role;
