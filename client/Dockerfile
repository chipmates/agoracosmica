# Build stage
FROM node:20-alpine AS build

# Use the pnpm version pinned in package.json's "packageManager" field
RUN corepack enable

WORKDIR /app

# Copy lockfile and manifest first for layer caching
COPY package.json pnpm-lock.yaml ./

# Install with frozen lockfile for reproducible builds
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the React app (vite outDir = 'build')
RUN pnpm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Add your custom nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]