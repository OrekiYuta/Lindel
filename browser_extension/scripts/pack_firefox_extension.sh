#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$EXT_DIR/dist"
FILENAME="lindel_firefox_extension.xpi"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cd "$EXT_DIR"
zip -r "$DIST_DIR/$FILENAME" . \
  -x "scripts/*" \
  -x "dist/*" \
  -x ".*"

echo "Done: $DIST_DIR/$FILENAME"
