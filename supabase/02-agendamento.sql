-- Nexo — agenda o servidor de avisos para rodar a cada minuto
-- Antes de rodar, troque os DOIS campos marcados abaixo. Depois cole no SQL Editor e clique em Run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('nexo-lembretes') where exists (select 1 from cron.job where jobname = 'nexo-lembretes');

select cron.schedule('nexo-lembretes', '* * * * *', $$
  select net.http_post(
    url     := 'https://kulegtlvqkycqhnamvmh.supabase.co/functions/v1/send-reminders',   -- ← troque kulegtlvqkycqhnamvmh
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', 'COLE-AQUI-O-CRON_SECRET'                                 -- ← troque pelo CRON_SECRET
    ),
    body    := '{}'::jsonb
  );
$$);
