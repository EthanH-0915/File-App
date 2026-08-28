FROM node:22-alpine

WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_UPLOAD_MAX_SIZE
ENV NEXT_PUBLIC_UPLOAD_MAX_SIZE=$NEXT_PUBLIC_UPLOAD_MAX_SIZE

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
