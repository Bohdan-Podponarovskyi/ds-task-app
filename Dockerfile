FROM node:18-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

# Install yarn if not already available
RUN corepack enable

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies using yarn
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Remove CLI packages since we don't need them in production by default.
# Remove this line if you want to run CLI commands in your container.

COPY . .

RUN yarn build

CMD ["yarn", "docker-start"]
