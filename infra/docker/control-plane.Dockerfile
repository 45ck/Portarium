FROM node:24-bookworm-slim AS build

WORKDIR /app
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY apps ./apps
COPY examples ./examples
COPY src ./src

RUN npm ci --legacy-peer-deps
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
  NPM_CONFIG_LEGACY_PEER_DEPS=true \
  PORTARIUM_CONTAINER_ROLE=control-plane \
  PORTARIUM_HTTP_PORT=8080 \
  PORTARIUM_OTEL_PORT=4317

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --legacy-peer-deps

COPY --from=build /app/dist ./dist

USER node

EXPOSE 8080

CMD ["node", "dist/src/presentation/runtime/control-plane.js"]
