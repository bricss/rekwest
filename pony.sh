#!/usr/bin/env bash
# Transforms extensions within source files

for file in dist/*.js; do
  echo "$file"
  sed -e 's/.\bmjs\b//g' -i "$file"
done
