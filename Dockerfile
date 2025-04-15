# Use Node.js LTS as base image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies (with custom script that handles both root and client)
RUN npm install
RUN cd client && npm install

# Copy source code
COPY . .

# Build the client application
RUN npm run client:build

# Expose the port the server runs on
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
