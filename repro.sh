#!/usr/bin/env bash
# usage: ./repro.sh https://<site>.netlify.app
# Each size is read 3 times: the first call fills the cache, the next calls should be cache hits.
set -uo pipefail
BASE=$1
RUN=${RUN:-$(date +%s)}
for mode in fetchWithCache direct; do
  for size in 100000 196608 196609 250000 1000000; do
    for attempt in fill read read; do
      printf '%-15s %-8s %-5s ' "$mode" "$size" "$attempt"
      curl -s -m 60 -w '\n%{http_code}' "$BASE/probe?size=$size&mode=$mode&run=$RUN" |
        node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const i=s.lastIndexOf("\n");const body=s.slice(0,i),code=s.slice(i+1);try{const r=JSON.parse(body);console.log(`intact=${r.intact} received=${r.receivedBytes}/${r.expectedBytes} encoding=${r.contentEncoding} length=${r.contentLength} status=${r.cacheStatus}`)}catch{console.log(`HTTP ${code}, not JSON: ${body.replace(/\s+/g," ").slice(0,80)}`)}})'
    done
  done
done
