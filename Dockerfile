FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# src (includes generators/templates) and SQL migrations read by the migrate runner
COPY --chown=node:node src ./src
COPY --chown=node:node db ./db

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
