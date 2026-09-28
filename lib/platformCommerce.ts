/**
 * Master switch for the money layer, mirroring the mobile app's
 * PAYMENTS_ENABLED (MarketPlaceMobile src/services/lib/platformCommerce.ts).
 *
 * false = classifieds mode: listings, chat, offers, profiles, wishlist,
 * report/block and account deletion work; there is no checkout, no orders,
 * no escrow, no wallet, no top-ups, no payouts and no boosts. Offers are a
 * handshake for an in-person handover, never a payment.
 *
 * Off unless NEXT_PUBLIC_PAYMENTS_ENABLED is exactly "true". Read on both the
 * client (to hide money UI) and the server (to refuse money routes) -- hiding
 * a button is not enough, the route must refuse too.
 */
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';
