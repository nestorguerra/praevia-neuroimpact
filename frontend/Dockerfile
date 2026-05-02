FROM node:24-alpine AS build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_PUBLIC_URL
ARG VITE_AUTH_MODE=supabase
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_TRACES_SAMPLE_RATE=0.05
ARG VITE_APP_ENV=production
ENV VITE_API_PUBLIC_URL=$VITE_API_PUBLIC_URL \
    VITE_AUTH_MODE=$VITE_AUTH_MODE \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_TRACES_SAMPLE_RATE=$VITE_SENTRY_TRACES_SAMPLE_RATE \
    VITE_APP_ENV=$VITE_APP_ENV
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
