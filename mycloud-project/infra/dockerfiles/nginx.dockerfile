FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY ../frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY ../frontend/ ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY ../infra/nginx.conf /etc/nginx/conf.d/default.conf

# Create directories for static and media files
RUN mkdir -p /usr/share/nginx/static /usr/share/nginx/media

# Expose ports
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
