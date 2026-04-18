FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3333
ENV RTPG_DATA_DIR=/app/rtpg_data

EXPOSE 3333

CMD ["npm", "run", "start"]
