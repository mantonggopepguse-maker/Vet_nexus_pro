# Stage 1: Build Frontend
FROM node:22-bookworm AS frontend-builder
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:22-bookworm AS backend-builder
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --legacy-peer-deps
COPY server/ .
RUN npx prisma generate
RUN npm run build

# Stage 3: Final Runtime
FROM node:22-bookworm
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Final setup for backend
WORKDIR /app/server
COPY --from=backend-builder /app/server/dist ./dist
COPY --from=backend-builder /app/server/prisma ./prisma
COPY --from=backend-builder /app/server/package.json ./

# Install only production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Re-generate Prisma client to ensure it's correctly placed in production node_modules
RUN npx prisma generate

# Set environment
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run from the server directory
CMD ["node", "dist/index.js"]
