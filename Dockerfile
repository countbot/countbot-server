# build stage
FROM node:10-alpine as build-stage
RUN mkdir -p /app
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

#production stage
FROM node:10-alpine as production-stage
RUN mkdir -p /app
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=build-stage /app/build ./build
EXPOSE 80

CMD ["npm", "run", "startProd"]