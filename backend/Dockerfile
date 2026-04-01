FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:18-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .
COPY --from=frontend-build /app/backend/frontend-dist ./frontend-dist

EXPOSE 3000

CMD ["node", "src/index.js"]
