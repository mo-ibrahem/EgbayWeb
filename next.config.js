/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fpqbocohjzwlfcmfropr.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // User uploads do not need executable SVG image support.
    contentDispositionType: 'attachment',
    formats: ['image/webp', 'image/avif'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
