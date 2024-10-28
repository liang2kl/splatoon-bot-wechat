FROM node:latest

# Create app directory
WORKDIR /app

RUN mkdir -p ./credentials && \
    touch splatoon-bot.memory-card.json && \
    ln -s splatoon-bot.memory-card.json ./credentials/splatoon-bot.memory-card.json

# Install app dependencies
COPY . .
RUN npm install

# Start the app
CMD ["npm", "start"]