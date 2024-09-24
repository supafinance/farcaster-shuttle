FROM oven/bun:latest

# Copy the project files
WORKDIR /app
COPY . .

# Command to run the app
CMD ["./run.sh", "all"]
