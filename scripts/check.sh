#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/3] Go tests"
docker run --rm -v "$ROOT_DIR":/src -w /src golang:1.21-alpine go test ./...

echo "[2/3] Web tests"
cd "$ROOT_DIR/web"
npm test

echo "[3/3] Web build"
npm run build

echo "✅ all checks passed"
