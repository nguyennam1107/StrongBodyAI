#!/bin/bash

echo "🧪 Demo: /send-mail API Endpoint"
echo "================================="

echo ""
echo "✅ Test 1: Valid validation response (missing fields)"
echo "------------------------------------------------"
curl -s -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to_email=test@example.com" | jq .

echo ""
echo "✅ Test 2: Email format validation"
echo "---------------------------------"
curl -s -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to_email=invalid-email&subject=Test&body=Test&smtp_user=invalid&smtp_pass=test" | jq .

echo ""
echo "✅ Test 3: SMTP authentication (expected to fail with fake credentials)"
echo "----------------------------------------------------------------------"
curl -s -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to_email=recipient@example.com&subject=Test Subject&body=<h1>Hello</h1><p>Test email via custom SMTP.</p>&smtp_user=sender@gmail.com&smtp_pass=fake-password" | jq .

echo ""
echo "🎯 API Summary:"
echo "==============="
echo "✅ Endpoint: POST /api/email/send-mail"
echo "✅ Content-Type: application/x-www-form-urlencoded OR application/json"
echo "✅ Required fields: to_email, subject, body, smtp_user, smtp_pass"
echo "✅ Optional fields: smtp_server (default: smtp.gmail.com), smtp_port (default: 587)"
echo "✅ Validation: Email format, required fields, SMTP authentication"
echo "✅ Response: JSON with success/error status and details"
echo ""
echo "📚 View full documentation: http://localhost:3000/api-docs"
