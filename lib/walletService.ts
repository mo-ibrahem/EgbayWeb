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
  type: 'escrow_hold' | 'escrow_release' | 'payout' | 'fee_deduction' | 'refund' | 'deposit' | 'top_up' | 'purchase';
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
const inMemoryWallets: Record<string, UserWallet> = {};
let inMemoryTransactions: WalletTransaction[] = [];
const inMemoryPayoutMethods: Record<string, PayoutMethod[]> = {};
const inMemorySellerTiers: Record<string, 1 | 2 | 3> = {};

export async function getUserWallet(userId: string): Promise<UserWallet> {
  try {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && !error) {
      return data as unknown as UserWallet;
    }

    if (!data) {
      const newWallet = {
        user_id: userId,
        pending_balance: 0,
        available_balance: 0,
        currency: 'EGP',
      };

      const { data: created } = await supabase
        .from('user_wallets')
        .insert(newWallet)
        .select()
        .maybeSingle();

      if (created) return created as unknown as UserWallet;
    }
  } catch (err) {
    console.warn('[WalletService] Supabase fallback to memory:', err);
  }

  if (!inMemoryWallets[userId]) {
    inMemoryWallets[userId] = {
      id: `wallet_${userId}`,
      user_id: userId,
      pending_balance: 0,
      available_balance: 0,
      currency: 'EGP',
      updated_at: new Date().toISOString(),
    };
  }
  return inMemoryWallets[userId];
}

export async function getSellerTier(userId: string): Promise<SellerTierConfig> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle();

    if (data && !error && (data as any).tier) {
      const t = ((data as any).tier as 1 | 2 | 3) || 1;
      return SELLER_TIERS[t] || SELLER_TIERS[1];
    }
  } catch (err) {
    console.warn('[WalletService] getSellerTier fallback:', err);
  }

  const tierNum = inMemorySellerTiers[userId] || 2;
  return SELLER_TIERS[tierNum];
}

export async function upgradeSellerTier(userId: string, targetTier: 1 | 2 | 3): Promise<SellerTierConfig> {
  try {
    await supabase
      .from('user_profiles')
      .update({
        tier: targetTier,
        tier_verified_at: new Date().toISOString(),
        is_verified_seller: targetTier >= 2,
      } as any)
      .eq('id', userId);
  } catch (err) {
    console.warn('[WalletService] Error updating tier in Supabase:', err);
  }

  inMemorySellerTiers[userId] = targetTier;
  return SELLER_TIERS[targetTier];
}

export async function holdEscrowForSeller(
  sellerId: string,
  orderId: string,
  totalAmount: number,
  promotedAdRate: number = 0
): Promise<void> {
  const sellerTier = await getSellerTier(sellerId);
  
  // 1. Calculate Platform Commission
  const baseFeePercent = sellerTier.commissionFeePercent;
  const platformCommission = Math.round(totalAmount * (baseFeePercent + (promotedAdRate || 0)));
  
  // 2. Calculate Paymob Payment Processing Fee (2.75% + 3 EGP)
  const paymobFee = Math.round((totalAmount * 0.0275) + 3);
  
  // 3. Calculate Total Deductions & Net Payout
  const totalDeductions = platformCommission + paymobFee;
  const netAmount = totalAmount - totalDeductions;
  
  const isInstantClearance = sellerTier.tier === 3;

  try {
    const wallet = await getUserWallet(sellerId);
    const newPending = isInstantClearance
      ? Number(wallet.pending_balance || 0)
      : (Number(wallet.pending_balance) || 0) + netAmount;
    const newAvailable = isInstantClearance
      ? (Number(wallet.available_balance) || 0) + netAmount
      : Number(wallet.available_balance || 0);

    // Direct DB mutation removed. Escrow hold is handled exclusively by the secure backend webhook.
  } catch (err) {
    console.warn('[WalletService] holdEscrowForSeller fallback to memory:', err);
  }
}

export async function releaseEscrowToSeller(orderId: string, sellerId: string, netAmount: number): Promise<void> {
  try {
    const wallet = await getUserWallet(sellerId);
    const newPending = Math.max(0, (Number(wallet.pending_balance) || 0) - netAmount);
    const newAvailable = (Number(wallet.available_balance) || 0) + netAmount;

    // Direct DB mutation removed. Escrow release is handled exclusively by the secure backend.
  } catch (err) {
    console.warn('[WalletService] releaseEscrowToSeller fallback:', err);
  }
}

export async function getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  try {
    const wallet = await getUserWallet(userId);
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false });

    if (data && !error && data.length > 0) {
      return data as unknown as WalletTransaction[];
    }
  } catch (err) {
    console.warn('[WalletService] getWalletTransactions fallback:', err);
  }

  return inMemoryTransactions.length > 0
    ? inMemoryTransactions
    : [
        {
          id: 'tx_demo_1',
          type: 'deposit',
          amount: 500,
          fee_amount: 0,
          status: 'completed',
          description: 'Top-Up via InstaPay',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          id: 'tx_demo_2',
          type: 'escrow_release',
          amount: 2850,
          fee_amount: 150,
          status: 'completed',
          description: 'Escrow Released: Order #89F2A1 (Includes Paymob Fees)',
          created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        },
      ];
}

const processedTransactionIds = new Set<string>();

export async function topUpUserWallet(
  userId: string,
  amount: number,
  method: 'card' | 'vodafone_cash' | 'instapay',
  transactionReferenceId?: string
): Promise<{ success: boolean; message: string }> {
  if (transactionReferenceId) {
    if (processedTransactionIds.has(transactionReferenceId)) {
      return { success: true, message: 'Transaction already credited' };
    }
    processedTransactionIds.add(transactionReferenceId);
  }

  const wallet = await getUserWallet(userId);
  const newAvailable = (Number(wallet.available_balance) || 0) + amount;

  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/wallet/action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` })
        },
        body: JSON.stringify({
          action: 'topup_manual',
          amount,
          paymentMethod: method
        })
      });
    }
  } catch (err) {
    console.warn('[WalletService] topUpUserWallet fallback to memory:', err);
  }

  wallet.available_balance = newAvailable;
  inMemoryTransactions.unshift({
    id: transactionReferenceId || `tx_${Date.now()}`,
    wallet_id: wallet.id,
    type: 'top_up',
    amount,
    fee_amount: 0,
    status: 'completed',
    description: `Deposit via ${method === 'instapay' ? 'InstaPay' : method === 'vodafone_cash' ? 'Vodafone Cash' : 'Debit/Credit Card'}`,
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: `EGP ${amount.toLocaleString('en-EG')} added to your Spendable Balance!`,
  };
}

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

  const newBalance = current - amount;
  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      console.log('[DEBUG WalletDeduct] Session exists?', !!session);
      console.log('[DEBUG WalletDeduct] User exists?', !!session?.user);
      console.log('[DEBUG WalletDeduct] Access token exists?', !!token);
      
      const authHeader = token ? `Bearer ${token.substring(0, 10)}...` : 'NONE';
      console.log('[DEBUG WalletDeduct] Sending Auth Header:', authHeader);

      await fetch('/api/wallet/action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'deduct_spendable',
          amount,
          orderId,
          itemTitle
        })
      });
    }
  } catch (err) {
    console.warn('[WalletService] deductWalletSpendableFunds fallback:', err);
  }

  wallet.available_balance = newBalance;
}

export async function getPayoutMethods(userId: string): Promise<PayoutMethod[]> {
  try {
    const { data, error } = await supabase
      .from('payout_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (data && !error && data.length > 0) {
      return data as unknown as PayoutMethod[];
    }
  } catch (err) {
    console.warn('[WalletService] getPayoutMethods fallback:', err);
  }

  return inMemoryPayoutMethods[userId] || [
    {
      id: 'pm_default_1',
      user_id: userId,
      type: 'instapay_ipa',
      account_identifier: 'username@instapay',
      account_holder_name: 'Mohamed Ibrahim',
      is_default: true,
      is_verified: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'pm_default_2',
      user_id: userId,
      type: 'vodafone_cash',
      account_identifier: '01012345678',
      account_holder_name: 'Mohamed Ibrahim',
      is_default: false,
      is_verified: true,
      created_at: new Date().toISOString(),
    },
  ];
}

export async function addPayoutMethod(
  userId: string,
  methodData: Omit<PayoutMethod, 'id' | 'created_at'>
): Promise<PayoutMethod> {
  const newMethod: PayoutMethod = {
    ...methodData,
    id: `pm_${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('payout_methods')
      .insert(newMethod as any)
      .select()
      .maybeSingle();

    if (data && !error) return data as unknown as PayoutMethod;
  } catch (err) {
    console.warn('[WalletService] addPayoutMethod fallback:', err);
  }

  if (!inMemoryPayoutMethods[userId]) inMemoryPayoutMethods[userId] = [];
  inMemoryPayoutMethods[userId].push(newMethod);
  return newMethod;
}

export async function requestPayout(
  userId: string,
  amount: number,
  payoutMethodId: string
): Promise<{ success: boolean; message: string; txId: string }> {
  const wallet = await getUserWallet(userId);
  const available = Number(wallet.available_balance) || 0;
  if (available < amount) {
    throw new Error(`Insufficient available balance (Available: EGP ${available.toLocaleString()})`);
  }

  const newBalance = available - amount;
  const txId = `tx_payout_${Date.now()}`;

  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/wallet/action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` })
        },
        body: JSON.stringify({
          action: 'request_payout',
          amount,
          payoutMethodId,
        })
      });
    }
  } catch (err) {
    console.warn('[WalletService] requestPayout fallback:', err);
  }

  wallet.available_balance = newBalance;
  return {
    success: true,
    message: `Payout request of EGP ${amount.toLocaleString('en-EG')} submitted! Withdrawals are safely processed in batches every Tuesday.`,
    txId,
  };
}
