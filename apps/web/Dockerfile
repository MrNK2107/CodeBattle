# Web app (Next.js, standalone output).
# Build from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SOCKET_URL=https://battle.example.com -t codebattle-web .
# NEXT_PUBLIC_SOCKET_URL is baked into the client bundle at build time.

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/problems/package.json packages/problems/
RUN npm ci --ignore-scripts
COPY prisma prisma
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY scripts/copy-monaco.mjs scripts/copy-monaco.mjs
RUN npx prisma generate \
  && npm run build -w @codebattle/shared \
  && npm run build -w @codebattle/web

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 nextjs
COPY --from=build --chown=nextjs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs /app/apps/web/public ./apps/web/public
# builds DATABASE_URL from PG* variables when compose passes those instead
COPY scripts/database-url.mjs ./scripts/database-url.mjs
COPY apps/web/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
