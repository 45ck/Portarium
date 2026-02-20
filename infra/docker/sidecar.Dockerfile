FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm ci
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
  PORTARIUM_CONTAINER_ROLE=sidecar \
  SIDECAR_LISTEN_PORT=15001 \
  SIDECAR_UPSTREAM_URL=http://localhost:3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

USER node

EXPOSE 15001

CMD ["node", "dist/infrastructure/sidecar/sidecar-main.js"]
