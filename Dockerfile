FROM node:20-alpine AS builder
ARG GITHUB_TOKEN
WORKDIR /app
COPY package*.json ./
COPY .npmrc ./.npmrc
RUN if [ -n "$GITHUB_TOKEN" ]; then \
      echo "//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN" >> .npmrc; \
    fi \
 && npm ci --ignore-scripts \
 && rm -f .npmrc
COPY . .
RUN npm run build

FROM node:20-alpine AS production
# OCI label links the GHCR package to this repository,
# enabling GITHUB_TOKEN write access from Actions workflows.
LABEL org.opencontainers.image.source="https://github.com/WYRE-AI/auvik-mcp"
LABEL io.modelcontextprotocol.server.name="io.github.WYRE-AI/auvik-mcp"
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001 -G appuser
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
RUN npm prune --omit=dev && npm cache clean --force
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
ENV NODE_ENV=production MCP_TRANSPORT=http MCP_HTTP_PORT=8080 LOG_LEVEL=info
CMD ["node", "dist/index.js"]