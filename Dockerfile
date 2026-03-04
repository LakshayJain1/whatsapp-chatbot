FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to configure the container
USER root
WORKDIR /app

# Copy package.json to install dependencies
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy all other project files
COPY . .

# Set exact permissions for the puppeteer user
RUN chown -R pptruser:pptruser /app

# Switch to puppeteer's default user
USER pptruser

# Command to start the application
CMD ["npm", "start"]
