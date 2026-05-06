 # Note to self: run at repo root
 # Use the latest Node.js image
FROM node:22-bookworm-slim

 # Install corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

 # Set the working directory. Every command after will run in this directory.
WORKDIR /app

# Copy everything in the current directory to the working directory.
COPY . .

# Install the dependencies.
RUN pnpm install --frozen-lockfile

# Start the application.
CMD ["pnpm", "--filter", "@prove-it/websocket", "dev"]