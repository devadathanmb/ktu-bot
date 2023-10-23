FROM node:20-slim
WORKDIR /bot
COPY package.json /bot
COPY package-lock.json /bot
RUN npm install
COPY . /bot
RUN npm run build
CMD ["npm", "run", "start"]
