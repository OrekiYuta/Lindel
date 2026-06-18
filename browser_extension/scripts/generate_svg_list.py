import os
import json

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))          # /script
PROJECT_ROOT = os.path.dirname(BASE_DIR)                      # project root
SVG_DIR = os.path.join(PROJECT_ROOT, "assets/img/pokemon-icons/svg")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "assets/json/svg-icons.json")

# Collect all .svg files (relative paths for frontend use)
svg_files = [
    f"assets/img/pokemon-icons/svg/{f}"
    for f in os.listdir(SVG_DIR)
    if f.lower().endswith(".svg")
]

# Save to JSON
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(svg_files, f, indent=2)

print(f"Generated {OUTPUT_FILE} with {len(svg_files)} SVG files.")
