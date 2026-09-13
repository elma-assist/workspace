FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY scripts/build-widget.mjs scripts/build-widget.mjs
COPY packages/agent-widget packages/agent-widget
COPY apps/landing/public apps/landing/public
RUN npm run build:widget

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/landing/public /usr/share/nginx/html
COPY --from=build /repo/packages/agent-widget/dist/widget.js /usr/share/nginx/html/widget.js
COPY --from=build /repo/node_modules/lucide-react/LICENSE /usr/share/nginx/html/icons-LICENSE.txt
