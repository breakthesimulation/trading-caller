FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm install --no-optional 2>&1 && echo "NPM INSTALL SUCCESS" || (echo "NPM INSTALL FAILED" && exit 1)

COPY . .

EXPOSE 3000

CMD ["npx", "tsx", "api/src/index.ts"]
