-- Enable the pg_cron extension if not already enabled
-- Note: On Supabase, you may need to enable this via the Dashboard first if it fails here
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to cancel abandoned orders
CREATE OR REPLACE FUNCTION public.cancel_abandoned_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Cancel orders stuck in pending_payment for more than 1 hour
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE status = 'pending_payment' 
    AND created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Schedule the job to run every 15 minutes
-- Job name: cancel_abandoned_orders_job
SELECT cron.schedule(
    'cancel_abandoned_orders_job',
    '*/15 * * * *',
    'SELECT public.cancel_abandoned_orders();'
);
