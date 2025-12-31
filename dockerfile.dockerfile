FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create the data directory
RUN mkdir -p /data

# Start the bot
CMD [ "npm", "start" ]