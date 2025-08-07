#!/bin/bash

# Test script for unified email system
echo "🧪 Testing Unified Email System"
echo "================================"

# Check if server is running
echo "📡 Checking if server is accessible..."
response=$(curl -s -w "%{http_code}" http://localhost:3000/api/email/test -o /tmp/test_response.json)

if [ "$response" = "200" ]; then
    echo "✅ Server is accessible"
    cat /tmp/test_response.json | jq .
else
    echo "❌ Server not accessible. Response code: $response"
    echo "Please start the server first: node src/server.js"
    exit 1
fi

echo ""
echo "🏥 Testing health endpoint..."
curl -s http://localhost:3000/api/email/health | jq .

echo ""
echo "📊 Testing queue stats..."
curl -s http://localhost:3000/api/email/queue/stats | jq .

echo ""
echo "👥 Testing accounts status..."
curl -s http://localhost:3000/api/email/accounts | jq .

echo ""
echo "📝 Testing templates..."
curl -s http://localhost:3000/api/email/templates | jq .

echo ""
echo "✅ All tests completed!"
echo ""
echo "📖 View full documentation at: http://localhost:3000/api-docs"

# Cleanup
rm -f /tmp/test_response.json
