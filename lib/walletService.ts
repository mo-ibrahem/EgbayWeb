import { supabase } from './supabase';

export interface UserWallet {
  id: string;
  user_id: string;
  pending_balance: number;
  available_balance: number;
  currency: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id?: string;
  order_id?: string;
  // Matches the transaction types actually written by the wallet RPCs
  // (checkout_with_wallet, release_escrow, request_wallet_payout,
  // purchase_boost, process_paymob_topup).
  type: 'escrow_hold' | 'earning' | 'withdrawal' | 'boost' | 'top_up' | 'purchase';
  amount: number;
  fee_amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  delta_available?: number;
  delta_pending?: number;
  created_at: string;
}

export interface PayoutMethod {
  id: string;
  user_id: string;
  type: 'vodafone_cash' | 'instapay_ipa' | 'orange_cash' | 'etisalat_cash' | 'bank_account';
  account_identifier: string;
  account_holder_name: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface SellerTierConfig {
  tier: 1 | 2 | 3;
  name: string;
  badge: string;
  commissionFeePercent: number;
  listingLimitCount: number;
  listingLimitAmount: number;
  fundReleaseTrigger: string;
  kycRequirement: string;
  payoutSpeed: string;
}

export interface NationalIdInfo {
  isValid: boolean;
  birthDate?: string;
  century?: number;
  gender?: 'male' | 'female';
  governorate?: string;
  error?: string;
}

export const EGYPTIAN_GOVERNORATE_CODES: Record<string, string> = {
  '01': 'Cairo (القاهرة)',
  '02': 'Alexandria (الإسكندرية)',
  '03': 'Port Said (بورسعيد)',
  '04': 'Suez (السويس)',
  '11': 'Damietta (دمياط)',
  '12': 'Dakahlia (الدقهلية)',
  '13': 'Ash Sharqia (الشرقية)',
  '14': 'Kaliobeya (القليوبية)',
  '15': 'Kafr El-Sheikh (كفر الشيخ)',
  '16': 'Gharbia (الغربية)',
  '17': 'Monufia (المنوفية)',
  '18': 'El Beheira (البحيرة)',
  '19': 'Ismailia (الإسماعيلية)',
  '21': 'Giza (الجيزة)',
  '22': 'Beni Suef (بني سويف)',
  '23': 'Fayoum (الفيوم)',
  '24': 'Minya (المنيا)',
  '25': 'Asyut (أسيوط)',
  '26': 'Sohag (سوهاج)',
  '27': 'Qena (قنا)',
  '28': 'Aswan (أسوان)',
  '29': 'Luxor (الأقصر)',
  '31': 'Red Sea (البحر الأحمر)',
  '32': 'New Valley (الوادي الجديد)',
  '33': 'Matrouh (مطروح)',
  '34': 'North Sinai (شمال سيناء)',
  '35': 'South Sinai (جنوب سيناء)',
  '88': 'Born Abroad (خارج الجمهورية)',
};

export function validateEgyptianNationalId(idNumber: string): NationalIdInfo {
  if (!idNumber || idNumber.length !== 14 || !/^\d{14}$/.test(idNumber)) {
    return { isValid: false, error: 'Must be exactly 14 digits' };
  }

  const centuryCode = parseInt(idNumber[0], 10);
  if (centuryCode !== 2 && centuryCode !== 3) {
    return { isValid: false, error: 'Invalid century code' };
  }

  const century = centuryCode === 2 ? 1900 : 2000;
  const year = century + parseInt(idNumber.substring(1, 3), 10);
  const month = parseInt(idNumber.substring(3, 5), 10);
  const day = parseInt(idNumber.substring(5, 7), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { isValid: false, error: 'Invalid birth date in National ID' };
  }

  const govCode = idNumber.substring(7, 9);
  const governorate = EGYPTIAN_GOVERNORATE_CODES[govCode] || 'Other Governorates (أخرى)';

  const genderDigit = parseInt(idNumber.substring(12, 13), 10);
  const gender = genderDigit % 2 === 0 ? 'female' : 'male';

  return {
    isValid: true,
    century,
    birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gender,
    governorate,
  };
}

export const SELLER_TIERS: Record<1 | 2 | 3, SellerTierConfig> = {
  1: {
    tier: 1,
    name: 'Casual Trader',
    badge: '🟡 Casual',
    commissionFeePercent: 0.035,
    listingLimitCount: 5,
    listingLimitAmount: 25000,
    fundReleaseTrigger: 'Buyer PIN verification or Courier delivery + 24 hrs',
    kycRequirement: 'Egyptian Mobile OTP (+20)',
    payoutSpeed: 'Standard (On-demand after escrow release)',
  },
  2: {
    tier: 2,
    name: 'Verified Trader',
    badge: '🛡️ Verified',
    commissionFeePercent: 0.025,
    listingLimitCount: 50,
    listingLimitAmount: 150000,
    fundReleaseTrigger: 'Instant QR / PIN scan or Courier delivery + 6 hrs',
    kycRequirement: 'National ID (بطاقة الرقم القومي) Front & Back',
    payoutSpeed: 'Fast (Instant to InstaPay & Mobile Wallets)',
  },
  3: {
    tier: 3,
    name: 'EgyBay Pro / Store',
    badge: '⭐ Pro Merchant',
    commissionFeePercent: 0.015,
    listingLimitCount: 999999,
    listingLimitAmount: 99999999,
    fundReleaseTrigger: 'Instant release upon courier pickup scan',
    kycRequirement: 'Commercial Registry (سجل تجاري) & Tax Card',
    payoutSpeed: 'Automated Daily Bank Settlement',
  },
};

// In-memory state
export async function getUserWallet(userId: string): Promise<UserWallet> {
  const { data, error } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as unknown as UserWallet;

  // No wallet row yet for this user — create one. This is a real insert,
  // not a fallback: every user needs exactly one wallet row.
  const { data: created, error: insertError } = await supabase
    .from('user_wallets')
    .insert({
      user_id: userId,
      pending_balance: 0,
      available_balance: 0,
      currency: 'EGP',
    })
    .select()
    .maybeSingle();

  if (insertError) throw insertError;
  if (!created) throw new Error('Failed to create wallet');
  return created as unknown as UserWallet;
}

export async function getSellerTier(userId: string): Promise<SellerTierConfig> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('tier')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const t = ((data as any)?.tier as 1 | 2 | 3) || 1;
  return SELLER_TIERS[t] || SELLER_TIERS[1];
}

export async function upgradeSellerTier(userId: string, targetTier: 1 | 2 | 3): Promise<SellerTierConfig> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      tier: targetTier,
      tier_verified_at: new Date().toISOString(),
      is_verified_seller: targetTier >= 2,
    } as any)
    .eq('id', userId);

  if (error) throw error;
  return SELLER_TIERS[targetTier];
}

export async function getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  const wallet = await getUserWallet(userId);
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as WalletTransaction[];
}

/**
 * Pays an existing marketplace order in full from the buyer's wallet
 * balance. `orderId` must be a real orders.id (uuid) — the server RPC
 * (checkout_with_wallet) derives the charge amount from that order row;
 * it does not trust amount/itemTitle from the client.
 */
export async function deductWalletSpendableFunds(
  userId: string,
  amount: number,
  orderId: string,
  itemTitle: string
): Promise<void> {
  const wallet = await getUserWallet(userId);
  const current = Number(wallet.available_balance) || 0;
  if (current < amount) {
    throw new Error('Insufficient wallet balance to cover purchase');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/wallet/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'deduct_spendable',
      amount,
      orderId,
      itemTitle,
    }),
  });

  const data = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
  if (!data.success) {
    throw new Error(data.error || 'Failed to pay with wallet balance');
  }
}

export async function getPayoutMethods(userId: string): Promise<PayoutMethod[]> {
  const { data, error } = await supabase
    .from('payout_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as PayoutMethod[];
}

export async function addPayoutMethod(
  userId: string,
  methodData: Omit<PayoutMethod, 'id' | 'created_at'>
): Promise<PayoutMethod> {
  // Let the database generate the id (payout_methods.id is a uuid primary
  // key with DEFAULT gen_random_uuid()) — a client-generated "pm_<ts>"
  // string is not a valid uuid and the insert would fail.
  const { data, error } = await supabase
    .from('payout_methods')
    .insert(methodData as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PayoutMethod;
}

export async function requestPayout(
  userId: string,
  amount: number,
  payoutMethodId: string
): Promise<{ success: boolean; message: string; payoutRequestId: string }> {
  const wallet = await getUserWallet(userId);
  const available = Number(wallet.available_balance) || 0;
  if (available < amount) {
    throw new Error(`Insufficient available balance (Available: EGP ${available.toLocaleString()})`);
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/wallet/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'request_payout',
      amount,
      payoutMethodId,
    }),
  });

  const data = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
  if (!data.success) {
    throw new Error(data.error || 'Failed to submit payout request');
  }

  return {
    success: true,
    message: `Payout request of EGP ${amount.toLocaleString('en-EG')} submitted! Withdrawals are safely processed in batches every Tuesday.`,
    payoutRequestId: data.payoutRequestId,
  };
}
