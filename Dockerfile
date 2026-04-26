FROM node:20-alpine

RUN addgroup -S webcraft && adduser -S webcraft -G webcraft

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src/      ./src/
COPY plugins/  ./plugins/
COPY scripts/  ./scripts/

RUN mkdir -p world data && chown -R webcraft:webcraft /app

USER webcraft

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/index.js"]
