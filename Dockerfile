FROM atomist/sdm-base:0.0.2

# Install yarn
RUN npm install --global yarn

# Install .NET Core tools
ENV DOTNET_CLI_TELEMETRY_OPTOUT 1
RUN apt-get update
RUN wget -q https://packages.microsoft.com/config/ubuntu/18.04/packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && apt-get install -y \
        apt-transport-https software-properties-common \
        openjdk-8-jdk-headless maven \
        libfontconfig \
        ca-certificates \
        curl \
        gnupg-agent \
        software-properties-common \
        golang

# Install Docker CLI
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
RUN add-apt-repository \
       "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
       $(lsb_release -cs) \
       stable"

RUN apt-get update && apt-get install -y \
        docker-ce docker-ce-cli \
        dotnet-sdk-2.2 \
        && rm -rf /var/lib/apt/lists/*

# Configure ECR Login Helper
ENV GOPATH /usr/local/src/go
RUN go get -u github.com/awslabs/amazon-ecr-credential-helper/ecr-login/cli/docker-credential-ecr-login && \
    mv /usr/local/src/go/bin/docker-credential-ecr-login /usr/local/bin/ && \
    chmod +x /usr/local/bin/docker-credential-ecr-login && \
    mkdir /root/.docker && \
    echo '{ "credsStore": "ecr-login" }' > /root/.docker/config.json

# Copy SDM project into place and install packages
COPY package.json package-lock.json ./
RUN npm ci \
    && npm cache clean --force
COPY . .
