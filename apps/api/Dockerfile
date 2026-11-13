FROM node:22-alpine
WORKDIR /workspace
RUN apk add --no-cache python3 make g++
COPY package.json ./package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN npm install
RUN npm run prisma:generate -w apps/api
COPY apps/api ./apps/api
WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
