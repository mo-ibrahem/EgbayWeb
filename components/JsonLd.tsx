import React from 'react';

interface JsonLdProps {
  data: Record<string, any>;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function MarketplaceJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://egbay.shop';

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: 'EgyBay',
        description: "Egypt's Trusted Peer-to-Peer Escrow Marketplace",
        publisher: {
          '@id': `${baseUrl}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}/?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
        inLanguage: ['en-US', 'ar-EG'],
      },
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: 'EgyBay Market',
        url: baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/icon.svg`,
          width: 512,
          height: 512,
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@egbay.market',
          areaServed: 'EG',
          availableLanguage: ['Arabic', 'English'],
        },
        sameAs: ['https://twitter.com/egbay_market', 'https://instagram.com/egbay.market'],
      },
    ],
  };

  return <JsonLd data={schema} />;
}

export function ProductJsonLd({
  product,
}: {
  product: {
    id: string;
    title: string;
    description?: string;
    price: number;
    images?: string[];
    condition?: string;
    category?: string;
    created_at?: string;
  };
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://egbay.shop';
  const imgUrl = product.images?.[0] || `${baseUrl}/icon.svg`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.images && product.images.length > 0 ? product.images : [imgUrl],
    description: product.description || `${product.title} on EgyBay Marketplace`,
    sku: product.id,
    category: product.category,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/products/${product.id}`,
      priceCurrency: 'EGP',
      price: product.price,
      priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      itemCondition:
        product.condition === 'New'
          ? 'https://schema.org/NewCondition'
          : 'https://schema.org/UsedCondition',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'EgyBay Verified Seller',
      },
    },
  };

  return <JsonLd data={schema} />;
}
