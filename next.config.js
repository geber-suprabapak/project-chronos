/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uacjwtyhlrwojwqdanop.supabase.co',
        port: '',
        // Allow both public and signed URLs
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'prod-db1.hyacine.my.id',
        port: '',
        // Allow both public and signed URLs
        pathname: '/storage/v1/object/**',
      }
    ],
  },
};

export default config;