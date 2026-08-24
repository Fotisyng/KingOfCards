FROM node:22.23.2-slim AS build
WORKDIR /repo
RUN corepack enable

# Copy only manifests first so this install layer stays cached across rebuilds that touch source but not dependencies.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/scheduler/package.json ./packages/scheduler/package.json
COPY packages/domain-shared/package.json ./packages/domain-shared/package.json
RUN pnpm install --frozen-lockfile

# Needs the *whole* workspace copied (unlike apps/api/Dockerfile) since tsc -b type-checks a
# devDependency import of @kingofcards/api's AppRouter, transitively resolving api's own deps too.
COPY . .

ARG VITE_API_URL=/trpc
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @kingofcards/web... build

FROM nginx:1.30.4-alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
