FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy ALL files from your GitHub repo into the container
COPY . .

# Install dependencies (using --omit=dev as the log suggested)
RUN npm install --omit=dev

# Ensure the data directory exists for your JSON files
RUN mkdir -p /data

CMD [ "node", "index.js" ]
