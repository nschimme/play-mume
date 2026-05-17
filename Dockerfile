FROM node:lts-alpine as builder

WORKDIR /usr/src/app

# Install curl
RUN apk add --no-cache curl

COPY . .
RUN npm install
RUN npm run lint:check
RUN npm run tsc
RUN npm run build
RUN npm test

# Download Arda.xml pinned to tag 42
RUN curl -fL https://raw.githubusercontent.com/MUME/arda/42/arda.xml -o arda.xml

# Convert map to JSON format
RUN npm run convert-map -- --strict arda.xml dist/mapdata

FROM nginx:alpine
COPY --from=builder /usr/src/app/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
