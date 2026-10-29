# syntax=docker/dockerfile:1

# deps: full install (tsc, tsx and drizzle-kit are devDependencies)
FROM node:24-alpine AS deps
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci

# build: TypeScript -> dist/
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# runner
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Full node_modules: `db:migrate` runs through tsx + drizzle-kit
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json drizzle.config.ts ./
COPY --chown=node:node src/db/migrations ./src/db/migrations
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && exec node dist/index.js"]
