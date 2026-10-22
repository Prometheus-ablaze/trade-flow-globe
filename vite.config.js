import { defineConfig } from 'vite';

// Absolute site origin for the link-preview tags in index.html. Set SITE_URL (e.g. https://tradeglobe.example.com)
// in the host's build settings; Vercel's production URL is picked up automatically. Without one, the tags
// fall back to root-relative paths, which work in some previews but not LinkedIn or Facebook.
function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return '';
}

export default defineConfig({
  plugins: [{
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl().replace(/\/$/, '')),
  }],
});
