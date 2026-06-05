FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies separately for layer caching
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Build TypeScript
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
# Generate Prisma Client. binaryTargets im schema.prisma definiert die
# Ziel-Binaries; Prisma 5.22 hat keine CLI-Option dafür.
# Wichtig: in Alpine 3.20+ muss binaryTargets = ["linux-musl-openssl-3.0.x"]
# gesetzt sein, sonst default'd Prisma auf "openssl-1.1.x" → libssl.so.1.1
# nicht im Image → Crash beim Start.
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

# Production image
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3001
USER node
CMD ["node", "dist/server.js"]
