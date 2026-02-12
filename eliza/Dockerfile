FROM node:23.3.0-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential curl g++ git make python3 unzip && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install bun via official script, copy to shared path
RUN curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun

WORKDIR /app

# Dependency manifests first (Docker layer cache)
COPY package.json bun.lock ./

# Install deps
RUN bun install --frozen-lockfile

# Copy only what's needed for the build
COPY src ./src
COPY build.ts tsconfig.json tsconfig.build.json ./

# Build the plugin
RUN bun run build

# Create elizaos wrapper pointing to local binary
RUN echo '#!/bin/bash\nexec /app/node_modules/.bin/elizaos "$@"' > /usr/local/bin/elizaos && \
    chmod +x /usr/local/bin/elizaos

# Prepare PGLite data dir on volume mount point
RUN mkdir -p /data/pglite && \
    chown -R node:node /app /data && \
    mkdir -p /home/node/.bun && chown -R node:node /home/node/.bun

USER node

EXPOSE 3000

CMD ["elizaos", "start"]
