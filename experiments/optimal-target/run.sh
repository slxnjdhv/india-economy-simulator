#!/bin/sh
# Reruns the whole experiment (about 1 minute on 8 cores), then the summary and chart.
cd "$(dirname "$0")" && mkdir -p runs
for v in shift engine; do for t in 0 0.005 0.01 0.015 0.02 0.025 0.03 0.035 0.04 0.045 0.05 0.055 0.06 0.065 0.07 0.075 0.08; do
  for s in 1 26 51 76; do echo "$v $t $s"; done; done; done |
  xargs -P 8 -n 3 sh -c 'node sweep.js $1 $2 $(($2+24)) 20 $0 > runs/$0_$1_$2.json'
node analyze.js && node make-chart.js
