 # Note to self: run at repo root
 # Use the latest Node.js image
FROM node:22-bookworm-slim

 # Install corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

 # Set the working directory. Every command after will run in this directory.
WORKDIR /app

# Copy dependency manifests first for better cache reuse.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/websocket/package.json ./apps/websocket/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/db/schema.prisma ./packages/db/


# Install deps and generate Prisma client as root (Corepack/pnpm need a writable cache).
RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate 

# Copy source last - changes here don't bust install cache
COPY . .

# Non-root runtime: own files after source copy, then drop privileges.
RUN useradd -r -u 999 -m appuser && chown -R appuser:appuser /app
USER appuser

# Expose the port the application will run on.
EXPOSE 3001

# Start the application.
CMD ["pnpm", "--filter", "@prove-it/websocket", "dev"]