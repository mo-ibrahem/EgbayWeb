import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://egbay.shop';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/products/*',
          '/privacy',
          '/terms',
          '/login',
          '/signup',
          '/sell',
        ],
        disallow: [
          '/wallet',
          '/orders',
          '/chat',
          '/boost',
          '/seller-verification',
          '/api/',
          '/_next/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/wallet',
          '/orders',
          '/chat',
          '/boost',
          '/seller-verification',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
