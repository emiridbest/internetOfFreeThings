import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://freethings.xyz', // For production, consider restricting this to specific domains
          },
          {
            key: 'Access-Control-Allow-Methods', 
            value: 'GET,OPTIONS,POST,PUT,DELETE'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
          }
        ]
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/dynamicauth/:path*',
        destination: 'https://app.dynamicauth.com/api/:path*',
      }
    ];
  }
};

export default nextConfig;
