FROM node:22-slim AS deps

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 git ca-certificates && \
    npm i -g prisma typescript@latest --force && \
    rm -rf /var/lib/apt/lists/*

# Copy only package files first for dependency caching
COPY apps/api/package*.json ./apps/api/
COPY apps/client/package*.json ./apps/client/

# Prisma schema needed for postinstall (prisma generate)
COPY apps/api/src/prisma ./apps/api/src/prisma

# Install dependencies (cached unless package.json changes)
RUN cd apps/api && npm install
RUN cd apps/client && npm install --legacy-peer-deps

FROM deps AS builder

# Now copy source code (this layer busts only on code changes)
COPY apps/api ./apps/api
COPY apps/client ./apps/client

RUN cd apps/api && npm run build
RUN cd apps/client && npm run build

FROM node:22-slim AS runner

WORKDIR /app

# Install only runtime deps, create non-root user, clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl tini && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    npm install -g pm2 && npm cache clean --force && \
    addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    mkdir -p /app/apps/api/uploads /app/.pm2 && \
    chown -R appuser:appgroup /app

COPY --from=builder --chown=appuser:appgroup /app/apps/api/ ./apps/api/
COPY --from=builder --chown=appuser:appgroup /app/apps/client/.next/standalone ./apps/client
COPY --from=builder --chown=appuser:appgroup /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=builder --chown=appuser:appgroup /app/apps/client/public ./apps/client/public
COPY --chown=appuser:appgroup ecosystem.config.js ./ecosystem.config.js

# Drop to non-root user
USER appuser
ENV PM2_HOME=/app/.pm2

EXPOSE 3000 5003

# Use tini as init to handle PID 1 and signal forwarding
ENTRYPOINT ["tini", "--"]
CMD ["pm2-runtime", "ecosystem.config.js"]
