#!/usr/bin/env bash
# Applies auxiliary transformations to source files

set -euo pipefail
shopt -s globstar nullglob

for file in dist/**/*; do
  [[ -f "$file" ]] || continue; echo "$file"
  sed -r 's/(require\(["'\''][^"'\'']*)\.js(["'\'']\))/\1.cjs\2/g' -i "$file"
done
