FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /data
CMD [ "node", "index.js" ]
