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
rollback;

-- A successful cron job can merely enqueue HTTP; it does not prove rates-sync ingested each source.
begin transaction read only;
set local statement_timeout = '15s';
select id, created, status_code, timed_out, error_msg is not null as has_transport_error,
       position('"bcv_official"' in coalesce(content, '')) > 0 as mentions_bcv_source,
       position('"dolarapi_oficial"' in coalesce(content, '')) > 0 as mentions_aggregator_source
  from net._http_response where created >= now() - interval '24 hours'
 order by created desc limit 100;
rollback;

begin transaction read only;
set local statement_timeout = '15s';
select exists(select 1 from vault.secrets where name = 'kora_project_url') as project_url_present,
       exists(select 1 from vault.secrets where name = 'kora_job_token') as job_token_present;
rollback;
