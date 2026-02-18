FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm ci
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
  PORTARIUM_CONTAINER_ROLE=execution-plane \
  PORTARIUM_HTTP_PORT=8081 \
  PORTARIUM_OTEL_PORT=4317

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

USER node

EXPOSE 8081

CMD ["node", "dist/presentation/runtime/worker.js"]
