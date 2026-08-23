FROM node:20.20.2-slim AS build
WORKDIR /repo
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
# '...' also builds this package's workspace dependencies (scheduler, domain-shared), not just api.
RUN pnpm --filter @kingofcards/api... build

# Repoints main/types to dist/, scoped to this build stage only. `packages/scheduler`/
# `domain-shared` keep "main": "./src/index.ts" for the dev/test loop (tsx/vitest/vite resolve it
# fine), but plain `node` below can't load a .ts entry point.
RUN pnpm --filter @kingofcards/scheduler --filter @kingofcards/domain-shared exec \
  pnpm pkg set main=./dist/index.js types=./dist/index.d.ts

# Reinstall --prod from scratch instead of `pnpm prune --prod`, which isn't workspace-recursive
# (it'd prune root's own empty "dependencies" and delete apps/api's real runtime deps).
RUN rm -rf node_modules apps/api/node_modules packages/*/node_modules && \
  pnpm install --prod --frozen-lockfile

FROM node:20.20.2-slim
ENV NODE_ENV=production
WORKDIR /repo
RUN corepack enable
COPY --from=build --chown=node:node /repo ./

USER node
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
