-- Optional protected domains for Marketplace only. No migrations or scheduler invocation.
-- Execute each transaction separately, ONLY if the corresponding relation exists in the core report.
-- Never emit cron.command, raw return_message, HTTP bodies/headers or decrypted Vault values.

begin transaction read only;
set local statement_timeout = '15s';
select jobid, jobname, schedule, active, md5(command) as command_md5 from cron.job order by jobname;
select j.jobname, d.status, d.start_time, d.end_time,
       d.return_message is not null as has_return_message
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
 where d.start_time >= now() - interval '24 hours' order by d.start_time desc limit 100;
-- Aggregate the full interval: frequent push jobs otherwise hide slower jobs in LIMIT 100.
select j.jobname, j.schedule, j.active, d.status, count(d.jobid) as runs,
       min(d.start_time) as first_start, max(d.start_time) as latest_start
  from cron.job j left join cron.job_run_details d
    on d.jobid = j.jobid and d.start_time >= now() - interval '24 hours'
 group by j.jobname, j.schedule, j.active, d.status order by j.jobname, d.status;
rollback;

-- A successful cron job can merely enqueue HTTP; it does not prove rates-sync ingested each source.
begin transaction read only;
set local statement_timeout = '15s';
select id, created, status_code, timed_out, error_msg is not null as has_transport_error,
       position('"bcv_official"' in coalesce(content, '')) > 0 as mentions_bcv_source,
       position('"dolarapi_oficial"' in coalesce(content, '')) > 0 as mentions_aggregator_source
  from net._http_response where created >= now() - interval '24 hours'
 order by created desc limit 100;
-- HTTP 200 can include a failed BCV source. Extract only safe fields from rate responses,
-- never full response bodies, request headers, raw error messages or customer information.
select r.id, r.created, r.status_code, item->>'source' as source,
       (item->>'ok')::boolean as source_ok,
       item->>'observedAt' as observed_at, item->>'rate' as returned_rate,
       substring(item->>'error' from 'HTTP [0-9]{3}') as provider_http_error,
       substring(item->>'error' from 'UnknownIssuer|CertExpired|NotValidYet|InvalidCertificate') as certificate_reason,
       case when item->>'error' ilike '%certificate%' then 'certificate'
            when item->>'error' ilike '%future%' then 'future_timestamp'
            when item->>'error' ilike '%USD block not found%' then 'bcv_html_parser'
            when item->>'error' ilike '%timeout%' or item->>'error' ilike '%Tiempo de espera%' then 'timeout'
            when item->>'error' ilike '%HTTP %' then 'http_error'
            when item->>'error' is not null then 'other_error' else null end as error_category
  from net._http_response r
 cross join lateral jsonb_array_elements(r.content::jsonb->'results') item
 where r.created >= now() - interval '6 hours'
   and position('"bcv_official"' in coalesce(r.content, '')) > 0
 order by r.created desc, item->>'source' limit 64;
rollback;

begin transaction read only;
set local statement_timeout = '15s';
select exists(select 1 from vault.secrets where name = 'kora_project_url') as project_url_present,
       exists(select 1 from vault.secrets where name = 'kora_job_token') as job_token_present;
rollback;
