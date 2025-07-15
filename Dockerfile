FROM browserless/chrome:latest

# Install FFmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    libvips-dev \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/temp /app/output

# Set environment variables
ENV NODE_ENV=production
ENV CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV SHARP_CACHE_SIZE=50

# Set proper permissions
RUN chown -R blessuser:blessuser /app/uploads /app/temp /app/output

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]