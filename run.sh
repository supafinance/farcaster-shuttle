#!/bin/bash

# Ensure you have node 21 installed, use nvm to install it
# Command: nvm install 21

# Read from environment variables or use default values
POSTGRES_URL=${POSTGRES_URL:-postgres://shuttle:password@0.0.0.0:6541}
REDIS_URL=${REDIS_URL:-redis://0.0.0.0:16379}
HUB_HOST=${HUB_HOST:-localhost}
HUB_PORT=${HUB_PORT:-2283}

# Install dependencies and build the project
function install {
    echo "Installing dependencies..."
    bun install
}

# Start the worker for reconciliation/backfill
function start_worker {
    echo "Starting the worker for reconciliation/b ackfill..."
    POSTGRES_URL=${POSTGRES_URL} REDIS_URL=${REDIS_URL} HUB_HOST=${HUB_HOST}:${HUB_PORT} HUB_SSL=false \
    bun start worker &
}

# Kick off the backfill process
function backfill {
    echo "Kicking off the backfill process..."
    POSTGRES_URL=${POSTGRES_URL} REDIS_URL=${REDIS_URL} HUB_HOST=${HUB_HOST}:${HUB_PORT} HUB_SSL=false \
    bun start backfill &
}

# Start the app and sync messages from the event stream
function start_app {
    echo "Starting the app and syncing messages from the event stream..."
    POSTGRES_URL=${POSTGRES_URL} REDIS_URL=${REDIS_URL} HUB_HOST=${HUB_HOST}:${HUB_PORT} HUB_SSL=false \
    bun start start &
}

# Main function to run all steps
function all {
    install
    start_worker
    backfill
    start_app
    wait
}

# Check for command line arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 {install|start_worker|backfill|start_app|all}"
    exit 1
fi

# Execute the requested function
$1