import type { NextConfig } from 'next';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    FFMPEG_PATH: ffmpegPath || '',
    FFPROBE_PATH: ffprobeStatic.path || '',
  },
  serverExternalPackages: ['ffmpeg-static', 'ffprobe-static'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/ffmpeg-static/**/*',
      './node_modules/ffprobe-static/**/*',
    ],
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  async headers() {
    // Allow embedding inside preview iframes (e.g., AI Studio) by omitting
    // X-Frame-Options / restrictive frame-ancestors here; standalone VPS
    // deployments can enforce X-Frame-Options at the Nginx layer if desired.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' blob: data:",
      "media-src 'self' blob: data: https://everyayah.com https://*.mp3quran.net https://cdn.mp3quran.net https://cdn.islamic.network",
      "connect-src 'self' blob: data: https://everyayah.com https://*.mp3quran.net https://cdn.mp3quran.net https://cdn.islamic.network",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
