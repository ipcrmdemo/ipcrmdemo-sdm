FROM atomist/sdm-base:0.0.1

COPY package.json package-lock.json ./

RUN npm ci \
    && npm cache clean --force \
    && mkdir /opt/data
  
COPY --from=gcr.io/kaniko-project/executor:v0.9.0 /kaniko /kaniko
COPY . .

