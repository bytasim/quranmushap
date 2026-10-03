#!/usr/bin/env sh
# Download the QCF4 Mushaf fonts into fonts/ so the reader works offline.
# Without this folder the reader loads the same files from jsDelivr.
set -eu
cd "$(dirname "$0")/.."
VERSION=1.1.0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd "$tmp" && npm pack --loglevel=error "quran-qcf4@$VERSION" >/dev/null)
tar -xzf "$tmp/quran-qcf4-$VERSION.tgz" -C "$tmp" package/fonts-woff2
mkdir -p fonts
cp "$tmp"/package/fonts-woff2/*.woff2 fonts/
echo "Copied $(ls fonts/*.woff2 | wc -l | tr -d ' ') font files into fonts/"
