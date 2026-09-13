FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
COPY packages/contracts packages/contracts
RUN npm run build -w apps/web
FROM node:22-slim
WORKDIR /srv
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node","apps/web/server.js"]
