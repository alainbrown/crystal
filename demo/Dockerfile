# Reproducible render of the Crystal demo (MP4 + GIF).
# Build context must be the repo root:  docker compose -f demo/docker-compose.yml run --rm render
FROM node:22-bookworm-slim

# Chrome Headless Shell runtime libraries (Remotion) + base fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 \
      libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 \
      libpango-1.0-0 libcairo2 libcups2 fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Install dependencies from the root manifest (single React instance, shared by
# the demo and the extension components it imports).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Extension source the demo imports, plus the demo project itself.
COPY src ./src
COPY demo ./demo

WORKDIR /app/demo
RUN npx remotion browser ensure

CMD ["sh", "-c", "\
  npx remotion render src/index.ts Demo out/crystal-demo.mp4 && \
  npx remotion render src/index.ts Demo out/crystal-demo.gif --codec=gif --every-nth-frame=2 --scale=0.42 \
"]
