FROM node:20-slim

WORKDIR /app

# Create data directory
RUN mkdir -p /data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy bot code
COPY index.js ./

# Volume for persistent data
VOLUME /data

CMD ["node", "index.js"]
