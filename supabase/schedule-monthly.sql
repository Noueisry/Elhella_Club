-- Optional: enable the pg_cron extension in the Supabase dashboard first.
-- Daily catch-up also covers reactivation; generation is idempotent.
select cron.schedule('smd-monthly-contributions','5 0 * * *', 'select smd.generate();');
