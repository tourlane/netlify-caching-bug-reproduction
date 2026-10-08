# Netlify Cache API: cache hits over 192 KiB come back cut

## Problem

A cache hit from the Netlify Cache API returns a broken body when the body is larger than 196,608 bytes (3 × 64 KiB):

- A miss returns the full body.
- A hit returns `content-encoding: br` and a `content-length` equal to the compressed size, and the decoded body is cut or mixed up.
- In our app, every hit for a 206 KB JSON body stopped at exactly 196,608 bytes. Some hits also had mixed-up content (`"one":wardsView`).
- Bodies of 128 KB are always intact.

This happens with `fetchWithCache` and with `caches.open()` + `cache.put()` + `cache.match()`. It happens with sequential requests, so it is not a race. It happens on `"Netlify Edge"; hit` responses.

Versions: `@netlify/cache` 3.4.9, `@netlify/functions` 5.1.3, functions region `eu-central-1`.

## Reproduce

1. Deploy this repo as a Netlify site.
2. Run `./repro.sh https://<site>.netlify.app`.

`/probe?size=<bytes>&mode=fetchWithCache|direct` makes a deterministic ASCII body of `size` bytes. It caches the body (`durable`, `ttl` 1 hour, tag `repro`), reads it back and compares it with the expected body.

The script reads each size 3 times: the first call fills the cache, the next 2 calls are hits. Set `RUN=<id>` to reuse keys, or leave it out to get new keys.

`/probe?action=purge` purges the `repro` tag.

## Expected result

Each line shows `intact=true`.

## Actual result

<!-- fill in after the first run -->
