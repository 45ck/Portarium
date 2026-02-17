FROM node:24-alpine

WORKDIR /app

COPY infra/docker/bootstrap.sh /usr/local/bin/portarium-runtime.sh
RUN chmod +x /usr/local/bin/portarium-runtime.sh

ENV NODE_ENV=production \
  PORTARIUM_CONTAINER_ROLE=execution-plane \
  PORTARIUM_HTTP_PORT=8081 \
  PORTARIUM_OTEL_PORT=4317

EXPOSE 8081

CMD ["/usr/local/bin/portarium-runtime.sh"]
