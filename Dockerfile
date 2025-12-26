# Multi-stage build for CF-Optimizer
# Supports: AMD64 (x86_64) and ARM64 (Oracle Cloud, Raspberry Pi)
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Backend builder
FROM node:18-alpine AS backend-builder

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Final production image
FROM node:18-alpine

WORKDIR /app

# Install production dependencies for backend
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy built backend
COPY --from=backend-builder /app/server/dist ./dist

# Copy built frontend
WORKDIR /app
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
WORKDIR /app/server
CMD ["node", "dist/index.js"]
