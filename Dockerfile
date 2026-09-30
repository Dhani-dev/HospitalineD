# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --force

FROM deps AS build
COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY src ./src
RUN npm run build

FROM deps AS prod
RUN npm prune --omit=dev
RUN node -e "require('pg')"

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=prod /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
