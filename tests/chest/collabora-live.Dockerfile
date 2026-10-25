FROM node:22.20.0-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends docker.io git openssl && apt-get clean
RUN npm install --global pnpm@10.12.4
WORKDIR /work
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile && pnpm exec playwright install --with-deps chromium
COPY . .
RUN pnpm run build
CMD ["node", "tests/chest/collabora-live.mjs"]
