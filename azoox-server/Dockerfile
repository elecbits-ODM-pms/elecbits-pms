FROM node:20-slim

# Install git and ca-certificates (for HTTPS git operations)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY index.js ./

# Persistent workspace mount point
ENV WORKSPACE=/data/azoox-workspace
RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "index.js"]
