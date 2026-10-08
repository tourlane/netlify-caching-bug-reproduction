> [!WARNING]
> # ⚠️ THIS IS A PUBLIC REPOSITORY ⚠️
>
> Everyone on the internet can read this repository. Do not add secrets, tokens, customer data, internal URLs or internal code.

# Netlify Cache API: large cache entries come back cut

## Problem

The Netlify Cache API returns a broken body for cache hits when the body is larger than about 100 KB. The test function is a plain Netlify function without a framework.

- The first call (cache miss) always returns the full body.
- A broken hit has `content-encoding: br`, and its body is shorter than the original. The cut length is different for each entry, but all reads of the same entry return the same cut length.
- The stored compressed size of a broken entry is too small. For example, a 196,608 byte body is stored as 10,430 bytes, which is about the size of the 100,000 byte body.
- The problem happens with `fetchWithCache` and with `caches.open()` + `cache.put()` + `cache.match()`. It happens with sequential requests, so it is not a race between requests.
- It is not consistent between runs. In run 2 below, the `direct` 196,608 byte entry was stored with 20,934 bytes and was intact.
- Some entries are not stored at all, without an error (for example `fetchWithCache` with 1,000,000 bytes).
- With `direct` and 1,000,000 bytes, the calls after the first call fail with a 504 "Inactivity Timeout" after about 30 seconds.

In our real application, this broke cached JSON files of about 206 KB, and `JSON.parse` failed. Files of about 128 KB were intact.

Versions: `@netlify/cache` 3.4.9, `@netlify/functions` 5.1.3.

## Reproduce

1. Deploy this repository as a Netlify site.
2. Run `./repro.sh https://<site>.netlify.app`.

`/probe?size=<bytes>&mode=fetchWithCache|direct&run=<id>` does these steps:

1. It makes a deterministic ASCII body of `size` bytes.
2. It caches the body with `durable`, `ttl` 1 hour and the tag `repro`.
3. It reads the body back and compares it with the expected body.

`run` makes the cache keys unique. The script reads each size 3 times: the first call fills the cache, and the next 2 calls should be cache hits.

`/probe?action=purge` purges the `repro` tag.

## Expected result

Each line shows `intact=true`, and each read after the first call is a cache hit.

## Actual result

Deployed site: https://cachingbugreproduction.netlify.app. Each run uses new cache keys.

### Run 1

```
fetchWithCache  100000   fill  intact=true received=100000/100000 encoding=null length=null status=null
fetchWithCache  100000   read  intact=true received=100000/100000 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
fetchWithCache  100000   read  intact=true received=100000/100000 encoding=br length=10388 status="Netlify Edge"; hit; ttl=3598
fetchWithCache  196608   fill  intact=true received=196608/196608 encoding=null length=null status=null
fetchWithCache  196608   read  intact=false received=155648/196608 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
fetchWithCache  196608   read  intact=false received=155648/196608 encoding=br length=13511 status="Netlify Edge"; hit; ttl=3600
fetchWithCache  196609   fill  intact=true received=196609/196609 encoding=null length=null status=null
fetchWithCache  196609   read  intact=true received=196609/196609 encoding=null length=null status=null
fetchWithCache  196609   read  intact=false received=122881/196609 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
fetchWithCache  250000   fill  intact=true received=250000/250000 encoding=null length=null status=null
fetchWithCache  250000   read  intact=false received=209040/250000 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
fetchWithCache  250000   read  intact=false received=209040/250000 encoding=br length=7976 status="Netlify Edge"; hit; ttl=3599
fetchWithCache  1000000  fill  intact=true received=1000000/1000000 encoding=null length=null status=null
fetchWithCache  1000000  read  intact=true received=1000000/1000000 encoding=null length=null status=null
fetchWithCache  1000000  read  intact=true received=1000000/1000000 encoding=null length=null status=null
direct          100000   fill  intact=true received=100000/100000 encoding=null length=null status=null
direct          100000   read  intact=true received=100000/100000 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
direct          100000   read  intact=true received=100000/100000 encoding=br length=10375 status="Netlify Edge"; hit; ttl=3598
direct          196608   fill  intact=true received=196608/196608 encoding=null length=null status=null
direct          196608   read  intact=true received=196608/196608 encoding=null length=null status=null
direct          196608   read  intact=true received=196608/196608 encoding=null length=null status=null
direct          196609   fill  intact=true received=196609/196609 encoding=null length=null status=null
direct          196609   read  intact=true received=196609/196609 encoding=null length=null status=null
direct          196609   read  intact=true received=196609/196609 encoding=null length=null status=null
direct          250000   fill  intact=true received=250000/250000 encoding=null length=null status=null
direct          250000   read  intact=false received=143504/250000 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
direct          250000   read  intact=false received=143504/250000 encoding=br length=7960 status="Netlify Edge"; hit; ttl=3599
direct          1000000  fill  HTTP 504, not JSON: <HTML> <HEAD> <TITLE>Inactivity Timeout</TITLE> ...
```

### Run 2

```
fetchWithCache  100000   fill  intact=true received=100000/100000 encoding=null length=null status=null
fetchWithCache  100000   read  intact=true received=100000/100000 encoding=br length=10428 status="Netlify Edge"; hit; ttl=3599
fetchWithCache  100000   read  intact=true received=100000/100000 encoding=br length=10428 status="Netlify Edge"; hit; ttl=3599
fetchWithCache  196608   fill  intact=true received=196608/196608 encoding=null length=null status=null
fetchWithCache  196608   read  intact=false received=131072/196608 encoding=br length=10430 status="Netlify Edge"; hit; ttl=3599
fetchWithCache  196608   read  intact=false received=131072/196608 encoding=br length=10430 status="Netlify Edge"; hit; ttl=3598
fetchWithCache  196609   fill  intact=true received=196609/196609 encoding=null length=null status=null
fetchWithCache  196609   read  intact=false received=163840/196609 encoding=br length=10470 status="Netlify Edge"; hit; ttl=3599
fetchWithCache  196609   read  intact=false received=163840/196609 encoding=br length=10470 status="Netlify Edge"; hit; ttl=3599
fetchWithCache  250000   fill  intact=true received=250000/250000 encoding=null length=null status=null
fetchWithCache  250000   read  intact=false received=176272/250000 encoding=br length=8019 status="Netlify Edge"; hit; ttl=3600
fetchWithCache  250000   read  intact=false received=176272/250000 encoding=br length=8019 status="Netlify Edge"; hit; ttl=3599
fetchWithCache  1000000  fill  intact=true received=1000000/1000000 encoding=null length=null status=null
fetchWithCache  1000000  read  intact=true received=1000000/1000000 encoding=null length=null status=null
fetchWithCache  1000000  read  intact=true received=1000000/1000000 encoding=null length=null status=null
direct          100000   fill  intact=true received=100000/100000 encoding=null length=null status=null
direct          100000   read  intact=true received=100000/100000 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
direct          100000   read  intact=true received=100000/100000 encoding=br length=10345 status="Netlify Edge"; hit; ttl=3599
direct          196608   fill  intact=true received=196608/196608 encoding=null length=null status=null
direct          196608   read  intact=true received=196608/196608 encoding=br length=null status="Netlify Durable"; hit; ttl=3599, "Netlify Edge"; fwd=miss; fwd-status=200; stored
direct          196608   read  intact=true received=196608/196608 encoding=br length=20934 status="Netlify Edge"; hit; ttl=3599
direct          196609   fill  intact=true received=196609/196609 encoding=null length=null status=null
direct          196609   read  intact=true received=196609/196609 encoding=null length=null status=null
direct          196609   read  intact=true received=196609/196609 encoding=null length=null status=null
direct          250000   fill  intact=true received=250000/250000 encoding=null length=null status=null
direct          250000   read  intact=true received=250000/250000 encoding=null length=null status=null
direct          250000   read  intact=true received=250000/250000 encoding=null length=null status=null
direct          1000000  fill  intact=true received=1000000/1000000 encoding=null length=null status=null
direct          1000000  read  HTTP 504, not JSON: <HTML> <HEAD> <TITLE>Inactivity Timeout</TITLE> ...
direct          1000000  read  HTTP 504, not JSON: <HTML> <HEAD> <TITLE>Inactivity Timeout</TITLE> ...
```

Note: run 1 used an older version of `repro.sh` that labelled the reads `hit` and stopped at the first non-JSON response. The output above uses the labels of the current script.

## Workaround

If we compress the body before we store it (gzip, `content-type: application/octet-stream`, about 30 KB instead of 206 KB), all cache hits are intact.
