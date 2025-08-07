#!/bin/bash

echo "🧪 Testing New /send-mail API Endpoint"
echo "====================================="

# Test 1: Missing required fields
echo ""
echo "📋 Test 1: Missing required fields"
echo "-----------------------------------"
curl -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to_email=test@example.com" | jq .

# Test 2: Invalid email format
echo ""
echo "📋 Test 2: Invalid email format"
echo "-------------------------------"
curl -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to_email=invalid-email&subject=Test&body=Test&smtp_user=invalid-sender&smtp_pass=test" | jq .

# Test 3: Valid request structure (will fail auth but shows validation works)
echo ""
echo "📋 Test 3: Valid request structure"
echo "----------------------------------"
curl -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to_email=recipient@example.com&subject=Test Subject&body=<h1>Hello</h1><p>This is a test email.</p>&smtp_user=sender@gmail.com&smtp_pass=fake-password" | jq .

# Test 4: JSON format (alternative)
echo ""
echo "📋 Test 4: JSON format (alternative)"
echo "------------------------------------"
curl -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "recipient@example.com",
    "subject": "Test JSON",
    "body": "<h1>JSON Test</h1><p>This is a JSON test.</p>",
    "smtp_user": "sender@gmail.com",
    "smtp_pass": "fake-password"
  }' | jq .

echo ""
echo "✅ API endpoint testing completed!"
echo ""
echo "📖 API Documentation:"
echo "URL: POST /api/email/send-mail"
echo "Content-Type: application/x-www-form-urlencoded"
echo "Required fields: to_email, subject, body, smtp_user, smtp_pass"
echo "Optional fields: smtp_server (default: smtp.gmail.com), smtp_port (default: 587)"
echo ""
echo "📚 Full Swagger docs: http://localhost:3000/api-docs"
