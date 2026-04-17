FROM node:20-slim

# Prisma's bundled debian-openssl-3.0.x binary requires libssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

# Workspace config (needed by pnpm for monorepo linking)
COPY pnpm-workspace.yaml .npmrc package.json pnpm-lock.yaml tsconfig.base.json ./

# Source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Install API + shared deps only (skips Next.js ~300MB)
RUN pnpm install --filter @researchvy/api...

# prisma generate uses default schema location (apps/api/prisma/schema.prisma)
RUN cd apps/api && node_modules/.bin/prisma generate

# Build shared types first (API imports from @researchvy/shared)
RUN pnpm --filter @researchvy/shared build

# Build API (tsc only — prisma already generated above)
RUN pnpm --filter @researchvy/api build

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
