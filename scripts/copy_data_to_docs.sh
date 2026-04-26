#!/bin/bash
# Copy data files to docs/ after Vite build
# These are loaded by the React app at runtime

DOCS=docs
DATA=data

cp "$DATA/tco_summary.json" "$DOCS/"
cp "$DATA/models.json" "$DOCS/"

# Copy individual TCO files (loaded lazily per model)
for f in "$DATA/tco/"*.json; do
  basename=$(basename "$f")
  model_id="${basename%.json}"
  cp "$f" "$DOCS/$model_id.json"
done

echo "Copied $(ls "$DATA/tco/"*.json | wc -l | tr -d ' ') model files + summary + models to docs/"
