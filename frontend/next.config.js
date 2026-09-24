/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.vercel.app'],
    },
  },

  /**
   * Route consolidation — docs/design/IA.md section 5.3.
   *
   * These are redirects rather than deletions, so no existing link breaks.
   * Each one removes a duplicate surface, not a capability.
   */
  async redirects() {
    return [
      // /dashboard *was* the login screen, with nothing saying so. The name
      // promised a dashboard and delivered a form; the real dashboard is
      // /console.
      { source: '/dashboard', destination: '/login', permanent: true },

      // Third sign-in surface, composing the same LoginForm in a different
      // component vocabulary.
      { source: '/preview', destination: '/login', permanent: true },

      // An index of feature routes — navigation rendered as a page. Redundant
      // once the app bar exists.
      { source: '/features', destination: '/console', permanent: true },

      // Loaded five heavy panels at once and duplicated /production, /blending
      // and /mine-twin wholesale. Its genuine per-mine content is the console
      // drill-down, which additionally carries provenance on every number.
      { source: '/features/:id', destination: '/console', permanent: true },

      // A loading *state* published as a navigable route. Replaced by a real
      // app/loading.tsx.
      { source: '/loading', destination: '/', permanent: true },

      // "Evaluator" names an audience, not a capability. The content is the
      // product's methodology and belongs to every user.
      { source: '/evaluator', destination: '/method', permanent: true },
    ]
  },
}

module.exports = nextConfig
