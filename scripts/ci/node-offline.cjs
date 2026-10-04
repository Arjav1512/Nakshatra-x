// Preloaded into the Next server in CI's offline browser jobs
// (NODE_OPTIONS=--require, scripts/ci/start-servers.sh offline).
//
// The server can resolve only this machine. The per-upstream overrides there
// cover the services the app declares (lib/upstreams.ts); this covers the rest
// — the auth integrations (Supabase, GitHub, Resend) and anything added later —
// so no external service can reach a required check from the Node side either.
const dns = require('node:dns')

const LOCAL = new Set(['localhost', '127.0.0.1', '::1'])

function refused(host) {
  const err = new Error(`getaddrinfo ENOTFOUND ${host} — CI offline: only this machine resolves (docs/CI.md)`)
  return Object.assign(err, { code: 'ENOTFOUND', hostname: host, syscall: 'getaddrinfo' })
}

const lookup = dns.lookup
dns.lookup = function offlineLookup(host, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  if (!LOCAL.has(host)) return process.nextTick(callback, refused(host))
  return lookup.call(this, host, options, callback)
}

const promisesLookup = dns.promises.lookup
dns.promises.lookup = (host, options) =>
  LOCAL.has(host) ? promisesLookup(host, options) : Promise.reject(refused(host))

// One line per process, so a CI log shows the block was in force.
process.stderr.write(`[node-offline] pid ${process.pid}: only this machine resolves\n`)
