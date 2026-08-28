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
    // Support HEIC and other formats by disabling optimization for those
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    formats: ['image/webp', 'image/avif'],
  },
};

module.exports = nextConfig;
