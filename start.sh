#!/usr/bin/env bash
# One-command way to run Anomaly Hunt locally.
#
# Usage:
#   ./start.sh
#
# This is the ONLY thing you need to run to play the game locally.
# Data for both game modes (Anomaly Hunt and Forecast Call) is generated
# live in the browser -- there's no separate data-build step, and no
# Python step required to play.
#
# The data-pipeline/ folder is a separate, optional reference
# implementation (see its own README) -- it's not part of this script
# because the live game doesn't depend on it.

set -e
cd "$(dirname "$0")/web"

echo "Installing dependencies (only takes a while the first time)..."
npm install

echo ""
echo "Starting Anomaly Hunt..."
npm run dev