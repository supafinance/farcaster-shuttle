# farcaster-shuttle

Set environment variables:

```bash
export HUB_HOST=
export HUB_PORT=

export POSTGRES_URL=
export REDIS_URL=
```

see .env.example

To run:

```bash
./run.sh all
```

## Run on AWS EC2 instance

Install dependencies:

```bash
sudo apt update
sudo apt install nodejs npm -y
sudo npm install -g tsx
tsx --version
```

Install bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

Run:

```bash
./run.sh all
```