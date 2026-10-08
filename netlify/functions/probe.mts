import { cacheHeaders, caches, fetchWithCache, getCacheStatus, HOUR } from '@netlify/cache'
import { purgeCache, type Config } from '@netlify/functions'
import { createHash } from 'node:crypto'

// Deterministic ASCII payload of exactly `size` bytes. The content does not matter.
function makePayload(size: number) {
  let seed = size
  const alphabet = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const chars = new Array<string>(size)
  for (let i = 0; i < size; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    chars[i] = alphabet[seed % alphabet.length]
  }
  return chars.join('')
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

const settings = { durable: true, ttl: HOUR, tags: ['repro'] }

export default async (req: Request) => {
  const url = new URL(req.url)
  if (url.searchParams.get('action') === 'purge') {
    await purgeCache({ tags: ['repro'] })
    return Response.json({ purged: true })
  }

  const size = Number(url.searchParams.get('size') ?? 250_000)
  const mode = url.searchParams.get('mode') ?? 'fetchWithCache'
  const run = url.searchParams.get('run') ?? '1'
  // The key only needs to be unique per size, mode and run.
  const key = `https://repro.invalid/payload?size=${size}&mode=${mode}&run=${run}`
  const expected = makePayload(size)

  let response: Response
  if (mode === 'direct') {
    const cache = await caches.open('repro')
    const cached = await cache.match(key)
    if (cached) {
      response = cached
    } else {
      const fresh = new Response(expected, {
        headers: { 'content-type': 'text/plain', ...cacheHeaders(settings) },
      })
      await cache.put(key, fresh.clone())
      response = fresh
    }
  } else {
    response = await fetchWithCache(key, {
      ...settings,
      fetch: async () => new Response(expected, { headers: { 'content-type': 'text/plain' } }),
    })
  }

  const body = await response.text()
  return Response.json({
    size,
    mode,
    run,
    cacheStatus: response.headers.get('cache-status'),
    hit: getCacheStatus(response)?.hit ?? false,
    contentLength: response.headers.get('content-length'),
    contentEncoding: response.headers.get('content-encoding'),
    expectedBytes: Buffer.byteLength(expected),
    receivedBytes: Buffer.byteLength(body),
    intact: body === expected,
    expectedSha: sha(expected),
    receivedSha: sha(body),
  })
}

export const config: Config = { path: '/probe' }
