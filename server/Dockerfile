# Simple single-stage build — this is a Node/Express API, not a compiled
# language, so there's no build step to separate out. Uses the same LTS
# major version as local development for consistency.
FROM node:22-alpine

WORKDIR /app

# Copy manifest files first so `npm ci` is cached separately from source
# code changes — rebuilding after editing a controller won't reinstall deps.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
