# 📧 Bulk Email Server API

Server API mạnh mẽ để gửi email hàng loạt sử dụng nhiều tài khoản Gmail với mật khẩu ứng dụng. Được xây dựng bằng Node.js và nodemailer.

## ✨ Tính năng

- 🔄 **Gửi email hàng loạt** với hàng nghìn người nhận
- 📧 **Nhiều tài khoản Gmail** với cân bằng tải tự động
- 🔒 **Bảo mật** với mật khẩu ứng dụng Gmail
- 📊 **Hàng đợi email** với Redis hoặc memory
- 📝 **Template engine** với Handlebars
- 📁 **Upload CSV** để import danh sách email
- 📈 **Theo dõi trạng thái** công việc gửi email
- 🛡️ **Rate limiting** tránh spam
- 📋 **Logging** chi tiết
- 🎨 **HTML email** với attachments

## 🚀 Cài đặt và Khởi chạy

### 1. Clone và cài đặt dependencies

```bash
cd /home/nguyennam/Code/Server
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Chỉnh sửa file `.env` với thông tin tài khoản Gmail của bạn:

```env
# Cấu hình cơ bản
NODE_ENV=development
PORT=3000

# Redis (tùy chọn - nếu không có sẽ dùng memory queue)
REDIS_HOST=localhost
REDIS_PORT=6379

# Cấu hình email accounts
EMAIL_USER_1=your-email-1@gmail.com
EMAIL_PASS_1=your-app-password-1

EMAIL_USER_2=your-email-2@gmail.com
EMAIL_PASS_2=your-app-password-2

EMAIL_USER_3=your-email-3@gmail.com
EMAIL_PASS_3=your-app-password-3

EMAIL_ACCOUNTS_COUNT=3
```

### 3. Tạo mật khẩu ứng dụng Gmail

1. Đăng nhập vào tài khoản Gmail
2. Vào **Cài đặt tài khoản Google** → **Bảo mật**
3. Bật **Xác minh 2 bước** (nếu chưa bật)
4. Tạo **Mật khẩu ứng dụng**:
   - Chọn ứng dụng: **Mail**
   - Chọn thiết bị: **Khác** → nhập tên (vd: "Bulk Email Server")
5. Copy mật khẩu 16 ký tự và dán vào file `.env`

### 4. Cài đặt Redis (Tùy chọn)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

### 5. Khởi chạy server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📖 API Documentation

### Health Check
```http
GET /health
GET /api/email/health
```

### Gửi email đơn lẻ
```http
POST /api/email/send
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Hello {{name}}!",
  "html": "<h1>Hello {{name}}!</h1><p>Welcome to our service.</p>",
  "text": "Hello {{name}}! Welcome to our service.",
  "senderName": "Your Company",
  "replyTo": "noreply@yourcompany.com"
}
```

### Gửi email hàng loạt
```http
POST /api/email/send-bulk
Content-Type: application/json

{
  "recipients": [
    {
      "email": "user1@example.com",
      "name": "User One",
      "firstName": "User",
      "customData": { "company": "ABC Corp" }
    },
    {
      "email": "user2@example.com",
      "name": "User Two",
      "firstName": "User"
    }
  ],
  "template": {
    "subject": "Welcome {{firstName}}!",
    "html": "<h1>Hello {{firstName}}!</h1><p>Thank you for joining {{customData.company}}.</p>",
    "text": "Hello {{firstName}}! Thank you for joining."
  },
  "options": {
    "senderName": "Your Company",
    "replyTo": "support@yourcompany.com",
    "priority": 5
  }
}
```

### Upload CSV và extract emails
```http
POST /api/email/upload-csv
Content-Type: multipart/form-data

# Form data:
csvFile: [CSV file]
emailColumn: "email"
nameColumn: "name"
firstNameColumn: "first_name"
lastNameColumn: "last_name"
```

**CSV Format ví dụ:**
```csv
email,name,first_name,last_name,company
john@example.com,John Doe,John,Doe,ABC Corp
jane@example.com,Jane Smith,Jane,Smith,XYZ Ltd
```

### Kiểm tra trạng thái job
```http
GET /api/email/job/{jobId}
```

### Quản lý hàng đợi
```http
GET /api/email/queue/stats
POST /api/email/queue/pause
POST /api/email/queue/resume
POST /api/email/queue/clean
```

### Kiểm tra tài khoản email
```http
GET /api/email/accounts
```

### Templates có sẵn
```http
GET /api/email/templates
POST /api/email/templates/validate
```

## 🎨 Template System

Server hỗ trợ Handlebars templates với các helper:

### Basic Variables
```handlebars
Hello {{name}}!
Your email: {{email}}
```

### Helpers
```handlebars
{{upperCase name}}          <!-- JOHN DOE -->
{{lowerCase email}}         <!-- john@example.com -->
{{capitalize firstName}}    <!-- John -->
{{formatDate date 'long'}}  <!-- January 15, 2024 -->
```

### Conditionals
```handlebars
{{#if company}}
  Welcome to {{company}}!
{{else}}
  Welcome!
{{/if}}

{{#ifEquals status 'premium'}}
  You are a premium member!
{{/ifEquals}}
```

### Templates có sẵn

1. **welcome** - Email chào mừng
2. **newsletter** - Bản tin
3. **promotional** - Email khuyến mãi

## 📊 Giới hạn và Best Practices

### Gmail Limits
- **500 emails/ngày** mỗi tài khoản Gmail
- Server tự động cân bằng tải giữa các tài khoản
- Delay 1 giây giữa các email để tránh spam

### Recommendations
- Sử dụng ít nhất 3-5 tài khoản Gmail cho volume lớn
- Không gửi quá 450 emails/ngày/tài khoản (để an toàn)
- Sử dụng Redis cho production để queue persistent
- Monitor logs thường xuyên

## 🔧 Cấu hình nâng cao

### Environment Variables

```env
# Rate limiting
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100     # Max requests per window

# Email settings
DAILY_EMAIL_LIMIT_PER_ACCOUNT=450  # Daily limit per Gmail account
EMAIL_SEND_DELAY=1000              # Delay between emails (ms)

# Queue settings
REDIS_HOST=localhost
REDIS_PORT=6379
```

### File Upload Limits
- CSV files: 10MB max
- Attachments: 10MB max per file
- Maximum 10 files per request

## 📝 Examples

### Example 1: Gửi email welcome đơn giản
```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Welcome!",
    "html": "<h1>Welcome to our service!</h1>",
    "senderName": "My Company"
  }'
```

### Example 2: Bulk email với template
```bash
curl -X POST http://localhost:3000/api/email/send-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"email": "user1@example.com", "firstName": "John"},
      {"email": "user2@example.com", "firstName": "Jane"}
    ],
    "template": {
      "subject": "Hello {{firstName}}!",
      "html": "<p>Hello {{firstName}}, how are you?</p>"
    }
  }'
```

### Example 3: Upload CSV
```bash
curl -X POST http://localhost:3000/api/email/upload-csv \
  -F "csvFile=@emails.csv" \
  -F "emailColumn=email" \
  -F "nameColumn=name"
```

## 🐛 Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Kiểm tra email và app password
   - Đảm bảo 2FA đã bật
   - Tạo lại app password

2. **"Daily limit exceeded"**
   - Thêm nhiều tài khoản Gmail
   - Giảm DAILY_EMAIL_LIMIT_PER_ACCOUNT

3. **"Redis connection failed"**
   - Cài đặt Redis hoặc thay đổi config
   - Server sẽ fallback về memory queue

4. **"Template compilation failed"**
   - Kiểm tra syntax Handlebars
   - Sử dụng endpoint `/api/email/templates/validate`

### Logs
Logs được lưu trong thư mục `logs/`:
- `combined.log` - Tất cả logs
- `error.log` - Chỉ errors
- `exceptions.log` - Uncaught exceptions

## 🚀 Production Deployment

### PM2
```bash
npm install -g pm2
pm2 start src/server.js --name "bulk-email-server"
pm2 startup
pm2 save
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/server.js"]
```

### Nginx Reverse Proxy
```nginx
location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

Nếu có vấn đề, hãy tạo issue trong repository hoặc liên hệ support.

---

**Happy Emailing!** 📧✨
