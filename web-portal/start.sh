#!/bin/bash
# Condo Manager Portal — Start Script
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [ ! -f .env.local ]; then
  echo "⚠️  Missing .env.local — copy from .env.example and add your NOTION_TOKEN"
  exit 1
fi

echo "🏢 Building Condo Manager Portal..."
npm run build

echo "🚀 Starting on http://localhost:3000"
npm start
