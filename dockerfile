FROM node:22-slim AS deps

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 git && \
    npm i -g prisma typescript@latest --force && \
    rm -rf /var/lib/apt/lists/*

# Copy only package files first for dependency caching
COPY apps/api/package*.json ./apps/api/
COPY apps/client/package*.json ./apps/client/

# Prisma schema needed for postinstall (prisma generate)
COPY apps/api/src/prisma ./apps/api/src/prisma

# Install dependencies (cached unless package.json changes)
RUN cd apps/api && npm install
RUN cd apps/client && yarn install --network-timeout 1000000 --frozen-lockfile || yarn install --network-timeout 1000000

FROM deps AS builder

# Now copy source code (this layer busts only on code changes)
COPY apps/api ./apps/api
COPY apps/client ./apps/client

RUN cd apps/api && npm run build
RUN cd apps/client && yarn build

FROM node:22-slim AS runner

RUN npm install -g pm2 && npm cache clean --force

COPY --from=builder /app/apps/api/ ./apps/api/
COPY --from=builder /app/apps/client/.next/standalone ./apps/client
COPY --from=builder /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=builder /app/apps/client/public ./apps/client/public
COPY ecosystem.config.js ./ecosystem.config.js

EXPOSE 3000 5003

CMD ["pm2-runtime", "ecosystem.config.js"]
