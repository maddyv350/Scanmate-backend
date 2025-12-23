#!/bin/bash

# Test script for getting chat rooms
# Replace YOUR_TOKEN with your actual JWT token

BASE_URL="http://43.204.209.39:8000/api/v1"
TOKEN="YOUR_TOKEN_HERE"

echo "Testing GET /chat/rooms"
echo "======================================"

curl -X GET "${BASE_URL}/chat/rooms" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""
echo "To get a token, first login:"
echo "curl -X POST ${BASE_URL}/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"your-email@example.com\",\"password\":\"your-password\"}'"

