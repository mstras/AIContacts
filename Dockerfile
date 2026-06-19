# ---- build stage: compile the React frontend ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime stage: server + built assets only ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8787

# Links this image to the GitHub repo so the GHCR package shows source + README.
LABEL org.opencontainers.image.source="https://github.com/mstras/AIContacts" \
      org.opencontainers.image.description="Upload a contacts CSV and enrich it via your own AI provider (Anthropic, OpenAI, or Gemini)." \
      org.opencontainers.image.licenses="MIT"

CMD ["node", "server/index.js"]
