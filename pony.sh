#!/usr/bin/env bash
# Transforms extensions within source file

for file in dist/*.js; do
  echo "$file"
  sed -i -e 's/.mjs/.js/g' "$file"
done
