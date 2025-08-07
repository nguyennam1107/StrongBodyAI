# ✉️ New API Endpoint: `/send-mail`

## 🎯 API Overview

**Endpoint**: `POST /api/email/send-mail`
**Purpose**: Send email using custom SMTP credentials provided in the request
**Content-Type**: `application/x-www-form-urlencoded` hoặc `application/json`

## 📋 Request Parameters

### Required Fields:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `to_email` | string (email) | Email người nhận | `recipient@example.com` |
| `subject` | string | Tiêu đề email | `Hello from Custom SMTP` |
| `body` | string | Nội dung email (HTML hoặc text) | `<h1>Hello!</h1><p>Test email.</p>` |
| `smtp_user` | string (email) | Email người gửi (Gmail) | `sender@gmail.com` |
| `smtp_pass` | string | Mật khẩu ứng dụng Gmail (App Password) | `abcd efgh ijkl mnop` |

### Optional Fields:
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `smtp_server` | string | `smtp.gmail.com` | SMTP server |
| `smtp_port` | integer | `587` | SMTP port |

## 🧪 Usage Examples

### 1. Form-Encoded Request:
```bash
curl -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to_email=recipient@example.com&subject=Test Subject&body=<h1>Hello</h1><p>This is a test.</p>&smtp_user=sender@gmail.com&smtp_pass=your-app-password"
```

### 2. JSON Request:
```bash
curl -X POST http://localhost:3000/api/email/send-mail \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "recipient@example.com",
    "subject": "Test Subject", 
    "body": "<h1>Hello</h1><p>This is a test.</p>",
    "smtp_user": "sender@gmail.com",
    "smtp_pass": "your-app-password"
  }'
```

## 📤 Response Format

### ✅ Success Response:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "email-message-id",
  "recipient": "recipient@example.com",
  "sender": "sender@gmail.com",
  "timestamp": "2025-08-07T11:00:00.000Z"
}
```

### ❌ Error Responses:

#### Missing Fields:
```json
{
  "success": false,
  "error": "Missing required fields",
  "details": [
    "subject is required",
    "body is required",
    "smtp_user is required",
    "smtp_pass is required"
  ]
}
```

#### Invalid Email Format:
```json
{
  "success": false,
  "error": "Invalid recipient email format"
}
```

#### SMTP Authentication Failed:
```json
{
  "success": false,
  "error": "SMTP authentication failed",
  "details": "Invalid login: Username and Password not accepted"
}
```

## 🔒 Security Features

1. **Email Validation**: Validates email format cho cả sender và recipient
2. **Required Fields Check**: Kiểm tra tất cả fields bắt buộc
3. **SMTP Verification**: Test SMTP connection trước khi gửi email
4. **Input Sanitization**: Secure handling của form data
5. **Error Handling**: Comprehensive error responses

## 🆚 So sánh với API khác

| Feature | `/send-mail` | `/send` | `/send-bulk` |
|---------|-------------|---------|--------------|
| **SMTP Config** | Custom per request | Pre-configured | Pre-configured |
| **Use Case** | External integration | Internal sending | Mass mailing |
| **Auth Method** | App Password in request | Environment config | Environment config |
| **Content-Type** | form-encoded OR JSON | JSON only | JSON only |
| **Queue Support** | No (immediate send) | No | Yes |
| **Template Support** | No | Basic | Advanced |

## 🎮 Integration Examples

### PHP Integration:
```php
$data = [
    'to_email' => 'recipient@example.com',
    'subject' => 'Hello from PHP',
    'body' => '<h1>Hello!</h1><p>Sent from PHP application.</p>',
    'smtp_user' => 'your-gmail@gmail.com',
    'smtp_pass' => 'your-app-password'
];

$response = file_get_contents('http://localhost:3000/api/email/send-mail', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query($data)
    ]
]));
```

### JavaScript/Node.js Integration:
```javascript
const response = await fetch('http://localhost:3000/api/email/send-mail', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        to_email: 'recipient@example.com',
        subject: 'Hello from Node.js',
        body: '<h1>Hello!</h1><p>Sent from Node.js application.</p>',
        smtp_user: 'your-gmail@gmail.com',
        smtp_pass: 'your-app-password'
    })
});

const result = await response.json();
console.log(result);
```

### Python Integration:
```python
import requests

data = {
    'to_email': 'recipient@example.com',
    'subject': 'Hello from Python',
    'body': '<h1>Hello!</h1><p>Sent from Python application.</p>',
    'smtp_user': 'your-gmail@gmail.com',
    'smtp_pass': 'your-app-password'
}

response = requests.post('http://localhost:3000/api/email/send-mail', data=data)
result = response.json()
print(result)
```

## 🛡️ Best Practices

1. **Use App Passwords**: Không sử dụng mật khẩu Gmail thường, tạo App Password
2. **Validate Inputs**: Always validate email addresses trước khi gọi API
3. **Handle Errors**: Implement proper error handling cho tất cả response codes
4. **Rate Limiting**: Respect Gmail's sending limits (500 emails/day cho free accounts)
5. **Security**: Không log hoặc expose `smtp_pass` trong logs

## 📚 Documentation

Full Swagger documentation available at: `http://localhost:3000/api-docs`

---

**✅ API `/send-mail` is now ready for production use!**
