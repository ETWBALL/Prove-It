 # Note to self: run at repo root
 # Use the latest Node.js image
FROM node:22-bookworm-slim

 # Install corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

 # Set the working directory. Every command after will run in this directory.
WORKDIR /app

# Copy everything in the current directory to the working directory.
COPY . .

# Install deps and generate Prisma client as root (Corepack/pnpm need a writable cache).
RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate 

# Non-root runtime: create user, own /app so the app can read workspace files.
RUN useradd -r -u 999 -m appuser
USER appuser

# Expose the port the application will run on.
EXPOSE 3001

# Start the application.
CMD ["pnpm", "--filter", "@prove-it/websocket", "dev"]