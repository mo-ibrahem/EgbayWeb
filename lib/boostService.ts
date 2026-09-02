import { supabase } from './supabase';
import { getUserWallet } from './walletService';

export interface BoostPackage {
  id: 'urgent' | 'featured' | 'turbo';
  title: string;
  badgeText: string;
  badgeEmoji: string;
  priceEGP: number;
  durationDays: number;
  multiplierText: string;
  description: string;
  perks: string[];
  gradient: [string, string];
}

export const BOOST_PACKAGES: Record<'urgent' | 'featured' | 'turbo', BoostPackage> = {
  urgent: {
    id: 'urgent',
    title: 'Urgent Sale (بيع عاجل)',
    badgeText: '🔥 URGENT DEAL',
    badgeEmoji: '🔥',
    priceEGP: 50,
    durationDays: 3,
    multiplierText: '2x More Views',
    description: 'Highlights your listing with an amber urgent badge for quick buyer response.',
    perks: ['🔥 Eye-catching Urgent Sale badge', '⚡ Ranks above standard listings in Home & Search', '⏳ Active for 3 days'],
    gradient: ['#F59E0B', '#D97706'],
  },
  featured: {
    id: 'featured',
    title: 'Featured Spotlight (إعلان مميز)',
    badgeText: '⚡ FEATURED SPOTLIGHT',
    badgeEmoji: '⚡',
    priceEGP: 150,
    durationDays: 7,
    multiplierText: '5x More Views',
    description: 'Pins your listing to the top of Home & Search results for a full week.',
    perks: [
      '⚡ Featured Spotlight badge on your listing',
      '🥇 Ranks above Urgent & standard listings in Home & Search',
      '📅 Active for 7 full days',
    ],
    gradient: ['#2563EB', '#1D4ED8'],
  },
  turbo: {
    id: 'turbo',
    title: 'Turbo 10x Max (ترويج شامل)',
    badgeText: '👑 TURBO 10X BOOST',
    badgeEmoji: '👑',
    priceEGP: 300,
    durationDays: 14,
    multiplierText: '10x Max Exposure',
    description: 'Maximum marketplace power — top ranking in Home & Search for a full 14 days.',
    perks: [
      '👑 Turbo Boost badge -- your listing\'s top identifier',
      '🚀 Ranks above every other listing in Home & Search',
      '📅 Active for 14 days',
    ],
    gradient: ['#7C3AED', '#4C1D95'],
  },
};

/**
 * Compact badge styling per tier for product cards / the product page
 * gallery, where BOOST_PACKAGES' full title and gradient pair are too
 * much for a small corner label. Every card and detail page badge reads
 * from here rather than hardcoding a single generic "Boosted" label, so
 * the tier a seller paid for is actually visible on the listing.
 */
export const BOOST_BADGE_STYLES: Record<'urgent' | 'featured' | 'turbo', { label: string; label_ar: string; className: string }> = {
  urgent: { label: 'Urgent Sale', label_ar: 'بيع عاجل', className: 'bg-amber-500' },
  featured: { label: 'Featured', label_ar: 'مميز', className: 'bg-brand' },
  turbo: { label: 'Turbo Boost', label_ar: 'ترويج شامل', className: 'bg-violet-600' },
};

const inMemoryPromotions: Record<string, { tier: string; until: string }> = {};

/**
 * Purchases a boost package using the seller's wallet balance.
 *
 * Card/Paymob checkout for boosts is intentionally not supported: the
 * payment webhook has no handler that activates a boost after a card
 * charge succeeds, so a card-paid boost would take the seller's money
 * and apply nothing. Wallet balance is the only path with a working,
 * server-authoritative activation (see /api/boost -> purchase_boost RPC).
 */
export async function boostProduct(
  productId: string,
  packageId: 'urgent' | 'featured' | 'turbo'
): Promise<{ success: boolean; message: string; promotedUntil: string }> {
  const pkg = BOOST_PACKAGES[packageId];
  if (!pkg) throw new Error('Invalid boost package selected');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch('/api/boost', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ productId, packageId }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to purchase boost');
  }

  return {
    success: true,
    message: `Your product is now boosted with ${pkg.title}!`,
    promotedUntil: data.promotedUntil,
  };
}
