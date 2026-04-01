FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM scratch
COPY --from=build /app/../backend/frontend-dist /frontend-dist
