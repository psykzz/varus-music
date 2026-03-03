FROM node:20-alpine

WORKDIR /app

# Prisma requires openssl; postgresql-client provides psql for init.sql
# ffmpeg is required by yt-dlp for audio/video processing
RUN apk add --no-cache openssl postgresql-client python3 py3-pip ffmpeg && \
    pip3 install --break-system-packages yt-dlp

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy application source
COPY src ./src

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
