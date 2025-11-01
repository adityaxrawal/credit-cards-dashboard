#!/bin/bash

# Credit Card Dashboard - Development Server Startup Script
# This script starts all development services in separate terminal tabs/windows

set -e

echo "🚀 Starting Credit Card Dashboard Development Servers"
echo "======================================================"

# Check OS for terminal commands
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Detected macOS - Starting in iTerm2/Terminal tabs..."
    
    # Start backend in new tab
    osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/backend/services/api-gateway\" && npm run dev"'
    
    # Wait a bit for backend to start
    sleep 3
    
    # Start frontend in new tab
    osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/frontend\" && npm run dev"'
    
    echo "✅ Services starting in separate terminal tabs"
    echo ""
    echo "Backend: http://localhost:3001"
    echo "Frontend: http://localhost:3000"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Detected Linux - Starting in tmux session..."
    
    # Check if tmux is installed
    if ! command -v tmux &> /dev/null; then
        echo "❌ tmux is not installed. Please install it first: sudo apt-get install tmux"
        exit 1
    fi
    
    # Create new tmux session
    tmux new-session -d -s credit-card-dashboard
    
    # Split window
    tmux split-window -h
    
    # Start backend in first pane
    tmux send-keys -t credit-card-dashboard:0.0 "cd backend/services/api-gateway && npm run dev" C-m
    
    # Start frontend in second pane
    tmux send-keys -t credit-card-dashboard:0.1 "cd frontend && npm run dev" C-m
    
    # Attach to session
    tmux attach-session -t credit-card-dashboard
    
else
    echo "Unsupported OS. Please start services manually:"
    echo ""
    echo "Terminal 1 - Backend:"
    echo "  cd backend/services/api-gateway && npm run dev"
    echo ""
    echo "Terminal 2 - Frontend:"
    echo "  cd frontend && npm run dev"
fi
