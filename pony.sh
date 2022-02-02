#!/usr/bin/env bash
# Transforms extensions within source files

for file in dist/*.js; do
  echo "$file"
  sed -i -e 's/.\bmjs\b/.js/g' "$file"
done
