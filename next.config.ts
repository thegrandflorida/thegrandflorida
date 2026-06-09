import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    domains: [
      'images.crexi.com',
      'photos.loopnet.com',
      'cdn.land.com',
      'api.mapbox.com',
    ],
  },
  transpilePackages: ['mapbox-gl'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'mapbox-gl': 'mapbox-gl',
    }
    return config
  },
}

export default nextConfig
