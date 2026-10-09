#!/usr/bin/env bash
# One-command way to run Anomaly Hunt locally.
#
# Usage:
#   ./start.sh
#
# This is the ONLY thing you need to run to play the game locally.
# Every case is generated live in the browser -- there's no separate
# data-build step required to play.

set -e
cd "$(dirname "$0")/web"

echo "Installing dependencies (only takes a while the first time)..."
npm install

echo ""
echo "Starting Anomaly Hunt..."
npm run dev
