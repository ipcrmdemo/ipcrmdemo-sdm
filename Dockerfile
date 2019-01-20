FROM atomist/sdm-base:0.0.1

COPY package.json package-lock.json ./

RUN npm ci \
    && npm cache clean --force

COPY . .

