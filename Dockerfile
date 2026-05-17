FROM node:lts-alpine AS builder

WORKDIR /usr/src/app

# Install curl
RUN apk add --no-cache curl

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Run build tasks
RUN npm run lint:check
RUN npm run tsc
RUN npm run build
RUN npm test

# Download Arda.xml pinned to a specific version (e.g. tag 42)
ARG ARDA_VERSION=42
RUN curl -fL https://raw.githubusercontent.com/MUME/arda/${ARDA_VERSION}/arda.xml -o arda.xml

# Convert map to JSON format
RUN npm run convert-map -- --strict arda.xml dist/mapdata

FROM nginx:alpine
COPY --from=builder /usr/src/app/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
