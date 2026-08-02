FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY front/package.json front/package.json
COPY back/package.json back/package.json
COPY shared/package.json shared/package.json
RUN npm ci
COPY shared shared
COPY back back
RUN npm run build --workspace @dartflow/shared && npm run build --workspace @dartflow/back

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/back/dist back/dist
COPY --from=build /app/back/package.json back/package.json
COPY --from=build /app/shared shared
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@dartflow/back"]
