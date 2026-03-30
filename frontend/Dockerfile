FROM node:20.19-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20.19-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY server.mjs ./server.mjs
COPY package.json ./package.json

EXPOSE 8080

CMD ["node", "server.mjs"]
