FROM oven/bun:1

WORKDIR /app

COPY . .

CMD ["./run.sh", "all"]