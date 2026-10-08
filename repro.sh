#!/usr/bin/env bash
# usage: ./repro.sh https://<site>.netlify.app
# Each size is read twice: the first call fills the cache, the second call is a cache hit.
set -euo pipefail
BASE=$1
RUN=${RUN:-$(date +%s)}
for mode in fetchWithCache direct; do
  for size in 100000 196608 196609 250000 1000000; do
    for attempt in fill hit hit; do
      printf '%-15s %-8s %-5s ' "$mode" "$size" "$attempt"
      curl -s "$BASE/probe?size=$size&mode=$mode&run=$RUN" |
        node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(`intact=${r.intact} received=${r.receivedBytes}/${r.expectedBytes} encoding=${r.contentEncoding} length=${r.contentLength} status=${r.cacheStatus}`)})'
    done
  done
done
