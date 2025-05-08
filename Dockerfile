# Use the official Node.js image
FROM node:20-slim

# Set environment variables
ARG COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=$COMMIT_SHA
ENV NODE_ENV=production

# Set work directory
WORKDIR /app

# Install system dependencies including ffmpeg for music features
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy project files
COPY . .

# Command to run the bot
CMD ["node", "index.js"]