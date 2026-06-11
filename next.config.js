/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'playwright',
    'playwright-core',
    'playwright-extra',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    'puppeteer-extra-plugin',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      // Prevent webpack from bundling playwright and puppeteer-extra packages
      // (they live in tools/node_modules and have complex native/dynamic deps)
      config.externals.push(({ request }, callback) => {
        if (/^playwright|^puppeteer|chromium-bidi/.test(request)) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
    }
    return config;
  },
}
module.exports = nextConfig
