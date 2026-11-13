FROM node:22-alpine
WORKDIR /workspace
RUN apk add --no-cache python3 make g++
COPY package.json ./package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm install
COPY apps/web ./apps/web
WORKDIR /workspace/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev"]
