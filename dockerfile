FROM node:18-alpine

# Set environment to production to skip dev-dependencies
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy package files
COPY package.json ./

# Install dependencies with increased network timeout and legacy-peer-deps
RUN npm install --network-timeout=100000

# Copy the rest of your code (index.js, etc)
COPY . .

# Create the data directory for your JSON files
RUN mkdir -p /data

CMD [ "node", "index.js" ]
