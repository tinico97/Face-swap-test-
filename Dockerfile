FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/tmp
ENV PORT=10000
EXPOSE 10000
CMD ["npm","start"]
