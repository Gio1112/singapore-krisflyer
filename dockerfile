FROM node:18-slim

# Install basic build tools just in case
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first to cache layers
COPY package*.json ./

# Use 'ci' for a cleaner, more reliable install in containers
RUN npm ci --only=production

# Copy the rest of the code
COPY . .

# Create data directory
RUN mkdir -p /data

CMD [ "node", "index.js" ]
