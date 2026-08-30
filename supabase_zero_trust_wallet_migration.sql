-- Create wallet_topups table
CREATE TABLE IF NOT EXISTS public.wallet_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    merchant_order_id TEXT UNIQUE NOT NULL,
    paymob_order_id BIGINT,
    paymob_transaction_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- Add paymob_transaction_id to wallet_transactions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallet_transactions' AND column_name='paymob_transaction_id') THEN
        ALTER TABLE public.wallet_transactions ADD COLUMN paymob_transaction_id BIGINT;
    END IF;
END $$;

-- Create unique index on wallet_transactions.paymob_transaction_id where not null
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_paymob_tx_unique ON public.wallet_transactions(paymob_transaction_id) WHERE paymob_transaction_id IS NOT NULL;

-- Enable RLS on wallet_topups
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own topups
CREATE POLICY "Users can view own topups" ON public.wallet_topups FOR SELECT USING (auth.uid() = user_id);

-- Create RPC for atomic wallet credit
CREATE OR REPLACE FUNCTION public.process_paymob_topup(
    p_merchant_order_id TEXT,
    p_paymob_tx_id BIGINT,
    p_amount_cents BIGINT,
    p_currency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_topup_id UUID;
    v_user_id UUID;
    v_amount NUMERIC(12, 2);
    v_currency VARCHAR(3);
    v_status VARCHAR(20);
    v_wallet_id UUID;
    v_available_balance NUMERIC(12, 2);
    v_amount_egp NUMERIC(12, 2);
BEGIN
    v_amount_egp := p_amount_cents / 100.0;

    -- 1. Find the topup and lock it
    SELECT id, user_id, amount, currency, status
    INTO v_topup_id, v_user_id, v_amount, v_currency, v_status
    FROM public.wallet_topups
    WHERE merchant_order_id = p_merchant_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Top-up not found for merchant_order_id: %', p_merchant_order_id;
    END IF;

    -- Idempotency: if already paid, return early (safe replay)
    IF v_status = 'paid' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already processed', 'user_id', v_user_id, 'amount', v_amount);
    END IF;

    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'Top-up is not in pending state (status: %)', v_status;
    END IF;

    -- 2. Validate amount and currency
    IF v_amount != v_amount_egp THEN
        RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_amount, v_amount_egp;
    END IF;

    IF v_currency != p_currency THEN
        RAISE EXCEPTION 'Currency mismatch: expected %, got %', v_currency, p_currency;
    END IF;

    -- 3. Lock the user's wallet
    SELECT id, available_balance
    INTO v_wallet_id, v_available_balance
    FROM public.user_wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create wallet if it doesn't exist
        INSERT INTO public.user_wallets (user_id, available_balance, pending_balance, currency)
        VALUES (v_user_id, 0, 0, 'EGP')
        RETURNING id, available_balance INTO v_wallet_id, v_available_balance;
    END IF;

    -- 4. Update wallet balance
    UPDATE public.user_wallets
    SET available_balance = available_balance + v_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- 5. Insert transaction ledger
    INSERT INTO public.wallet_transactions (
        wallet_id,
        type,
        amount,
        fee_amount,
        status,
        description,
        paymob_transaction_id
    ) VALUES (
        v_wallet_id,
        'top_up',
        v_amount,
        0,
        'completed',
        'Wallet Deposit via Paymob (Txn: ' || p_paymob_tx_id || ')',
        p_paymob_tx_id
    );

    -- 6. Update top-up status
    UPDATE public.wallet_topups
    SET status = 'paid',
        paymob_transaction_id = p_paymob_tx_id,
        paid_at = NOW()
    WHERE id = v_topup_id;

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'amount', v_amount);
END;
$$;
