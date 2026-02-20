# Portarium Sidecar -- design-level Dockerfile
#
# This sidecar runs alongside workload containers, handling:
# - mTLS termination (SPIFFE/SPIRE SVID)
# - Automatic JWT token acquisition and refresh
# - Egress allowlist enforcement
# - W3C trace-context header injection
#
# Production builds will use a distroless base for minimal attack surface.

FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/infrastructure/sidecar/ ./src/infrastructure/sidecar/
COPY src/application/common/trace-context.ts ./src/application/common/trace-context.ts

# Build sidecar module
RUN npx tsc --outDir dist --declaration --module nodenext --moduleResolution nodenext --target es2022

# ---------------------------------------------------------------------------

FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/

# Sidecar ports
# 15000 = admin/health
# 15001 = egress proxy
EXPOSE 15000 15001

ENV NODE_ENV=production
ENV SIDECAR_ADMIN_PORT=15000
ENV SIDECAR_PROXY_PORT=15001

ENTRYPOINT ["/nodejs/bin/node", "dist/infrastructure/sidecar/portarium-sidecar.js"]
