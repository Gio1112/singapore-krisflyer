FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy all other source files (index.js, etc.)
COPY . .

# Create the data directory for your persistent JSON files
RUN mkdir -p /data

CMD [ "node", "index.js" ]
