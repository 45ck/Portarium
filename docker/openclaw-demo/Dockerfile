FROM node:22-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S portarium && adduser -S portarium -G portarium

COPY agent.mjs .

# Drop privileges
USER portarium

ENV PROXY_URL=http://host.docker.internal:9999

CMD ["node", "agent.mjs"]
