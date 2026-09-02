import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EgyBay — Egypt's Trusted Escrow Marketplace",
    short_name: 'EgyBay',
    description: 'Buy and sell anything safely in Egypt with 100% escrow protection, doorstep courier delivery, and instant local payouts.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#3665F3',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
