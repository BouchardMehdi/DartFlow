FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY front/package.json front/package.json
COPY back/package.json back/package.json
COPY shared/package.json shared/package.json
RUN npm ci
COPY shared shared
RUN npm run build --workspace @dartflow/shared
COPY front front
ARG BACKEND_INTERNAL_URL=http://back:4000
ARG NEXT_PUBLIC_REALTIME_URL
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL
RUN npm run build --workspace @dartflow/front

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/front front
COPY --from=build /app/shared shared
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@dartflow/front"]
