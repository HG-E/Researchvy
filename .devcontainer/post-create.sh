#!/bin/bash
# .devcontainer/post-create.sh
# Runs once after the Codespaces/devcontainer is created.
# Sets up the full development environment automatically.

set -e  # Exit on any error
echo "🚀 Setting up Researchvy development environment..."

# ── 1. Install pnpm ─────────────────────────────────────────────────────────
echo "📦 Installing pnpm..."
npm install -g pnpm@9

# ── 2. Install Node.js dependencies ─────────────────────────────────────────
echo "📦 Installing Node.js dependencies..."
pnpm install

# ── 3. Install Python dependencies ──────────────────────────────────────────
echo "🐍 Installing Python worker dependencies..."
cd workers && pip install -r requirements.txt && cd ..

# ── 4. Copy env file if not present ─────────────────────────────────────────
if [ ! -f .env ]; then
  echo "⚙️  Creating .env from .env.example..."
  cp .env.example .env
  echo ""
  echo "⚠️  IMPORTANT: Edit .env and fill in:"
  echo "   - JWT_SECRET (run: openssl rand -hex 64)"
  echo "   - ENCRYPTION_KEY (run: openssl rand -hex 32)"
  echo "   - ORCID_CLIENT_ID + ORCID_CLIENT_SECRET"
  echo "   Register ORCID sandbox app at: https://sandbox.orcid.org/developer-tools"
fi

# ── 5. Generate Prisma client ────────────────────────────────────────────────
echo "🗄️  Generating Prisma client..."
pnpm db:generate

# ── 6. Run database migrations ───────────────────────────────────────────────
echo "🗄️  Running database migrations..."
# Wait for Postgres to be fully ready
until pnpm exec prisma db push --skip-generate 2>/dev/null; do
  echo "   Waiting for database..."
  sleep 2
done

# ── 7. Seed database with demo data ──────────────────────────────────────────
echo "🌱 Seeding database..."
pnpm db:seed || echo "Seed skipped (may already be seeded)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Run these in separate terminals:"
echo "  pnpm dev          → Start API + Web"
echo "  python workers/worker.py  → Start data sync worker"
echo ""
echo "Demo login: demo@researchvy.com / demo1234"
echo "API docs:   http://localhost:3001/docs"
