# ---- build stage: frontend bundle + compiled native deps ----
FROM node:20-alpine AS build
# build tools for better-sqlite3's native addon
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# drop dev deps so only runtime deps (express, better-sqlite3) remain compiled
RUN npm prune --omit=dev

# ---- runtime stage: server + built assets, no build tools ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY server ./server
VOLUME ["/data"]
EXPOSE 8787

LABEL org.opencontainers.image.source="https://github.com/mstras/AIContacts" \
      org.opencontainers.image.description="Enrich contacts via your own AI provider (Anthropic, OpenAI, Gemini) and sync with Google Contacts." \
      org.opencontainers.image.licenses="MIT"

CMD ["node", "server/index.js"]
