# Battle server (Express + Socket.io + judging worker).
# Build from the repository root:  docker build -f apps/server/Dockerfile -t codebattle-server .

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/problems/package.json packages/problems/
RUN npm ci --ignore-scripts
COPY prisma prisma
COPY packages packages
COPY apps/server apps/server
COPY scripts scripts
RUN npx prisma generate \
  && npm run build -w @codebattle/shared \
  && npm run build -w @codebattle/server

FROM base AS runtime
ENV NODE_ENV=production
# the docker CLI lets CODE_RUNNER=docker reach a daemon through DOCKER_HOST or a mounted socket
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=build /app /app
COPY apps/server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/server/dist/index.js"]
