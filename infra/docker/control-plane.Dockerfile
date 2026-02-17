FROM node:24-alpine

WORKDIR /app

COPY infra/docker/bootstrap.sh /usr/local/bin/portarium-runtime.sh
RUN chmod +x /usr/local/bin/portarium-runtime.sh

ENV NODE_ENV=production \
  PORTARIUM_CONTAINER_ROLE=control-plane \
  PORTARIUM_HTTP_PORT=8080 \
  PORTARIUM_OTEL_PORT=4317

EXPOSE 8080

CMD ["/usr/local/bin/portarium-runtime.sh"]
