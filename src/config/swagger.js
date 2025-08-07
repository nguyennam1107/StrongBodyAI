const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bulk Email Server API',
      version: '1.0.0',
      description: `
        🚀 **API Server gửi email hàng loạt sử dụng nhiều tài khoản Gmail**
        
        Server API mạnh mẽ để gửi email hàng loạt với các tính năng:
        - 📧 Gửi email hàng loạt với hàng nghìn người nhận
        - 🔄 Hỗ trợ nhiều tài khoản Gmail với cân bằng tải
        - 📝 Template engine với Handlebars
        - 📊 Upload CSV để import danh sách email
        - 🔄 Hàng đợi email với job tracking
        - 🛡️ Rate limiting và bảo mật
        
        ## 🚀 Getting Started
        
        1. Cấu hình tài khoản Gmail trong file \`.env\`
        2. Tạo App Passwords cho Gmail
        3. Khởi động server: \`npm start\`
        4. Truy cập Swagger UI tại: \`/api-docs\`
        
        ## 📧 Gmail Setup
        
        Để sử dụng Gmail SMTP:
        1. Bật 2-Step Verification
        2. Tạo App Password: Google Account → Security → App passwords
        3. Thêm vào \`.env\`:
           \`\`\`
           EMAIL_USER_1=your-email@gmail.com
           EMAIL_PASS_1=your-app-password
           \`\`\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://your-domain.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Email',
        description: 'Email sending operations'
      },
      {
        name: 'Queue',
        description: 'Job queue management'
      },
      {
        name: 'Templates',
        description: 'Email template operations'
      },
      {
        name: 'Upload',
        description: 'File upload operations'
      },
      {
        name: 'Accounts',
        description: 'Email account management'
      }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Detailed error information'
            }
          }
        },
        EmailRecipient: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address of recipient',
              example: 'user@example.com'
            },
            name: {
              type: 'string',
              description: 'Full name of recipient',
              example: 'John Doe'
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'John'
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Doe'
            },
            customData: {
              type: 'object',
              description: 'Custom data for template variables',
              example: {
                company: 'ABC Corp',
                position: 'Developer'
              }
            }
          }
        },
        EmailTemplate: {
          type: 'object',
          required: ['subject'],
          properties: {
            subject: {
              type: 'string',
              description: 'Email subject with Handlebars template syntax',
              example: 'Welcome {{firstName}}!'
            },
            html: {
              type: 'string',
              description: 'HTML email content with Handlebars template syntax',
              example: '<h1>Hello {{firstName}}!</h1><p>Welcome to {{company}}!</p>'
            },
            text: {
              type: 'string',
              description: 'Plain text email content',
              example: 'Hello {{firstName}}! Welcome to {{company}}!'
            }
          }
        },
        SingleEmailRequest: {
          type: 'object',
          required: ['to', 'subject'],
          properties: {
            to: {
              type: 'string',
              format: 'email',
              description: 'Recipient email address',
              example: 'recipient@example.com'
            },
            subject: {
              type: 'string',
              description: 'Email subject',
              example: 'Hello from Bulk Email Server!'
            },
            html: {
              type: 'string',
              description: 'HTML email content',
              example: '<h1>Hello!</h1><p>This is a test email.</p>'
            },
            text: {
              type: 'string',
              description: 'Plain text email content',
              example: 'Hello! This is a test email.'
            },
            senderName: {
              type: 'string',
              description: 'Display name for sender',
              example: 'My Company'
            },
            replyTo: {
              type: 'string',
              format: 'email',
              description: 'Reply-to email address',
              example: 'noreply@example.com'
            }
          }
        },
        BulkEmailRequest: {
          type: 'object',
          required: ['recipients', 'template'],
          properties: {
            recipients: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/EmailRecipient'
              },
              description: 'List of email recipients',
              minItems: 1,
              maxItems: 10000
            },
            template: {
              $ref: '#/components/schemas/EmailTemplate'
            },
            options: {
              type: 'object',
              properties: {
                senderName: {
                  type: 'string',
                  description: 'Display name for sender',
                  example: 'Newsletter Team'
                },
                replyTo: {
                  type: 'string',
                  format: 'email',
                  description: 'Reply-to email address',
                  example: 'newsletter@example.com'
                },
                priority: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 10,
                  description: 'Job priority (0-10, higher = more priority)',
                  example: 5
                }
              }
            }
          }
        },
        JobStatus: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Job ID',
              example: '123'
            },
            state: {
              type: 'string',
              enum: ['waiting', 'active', 'completed', 'failed'],
              description: 'Current job state'
            },
            progress: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Job progress percentage',
              example: 75
            },
            result: {
              type: 'object',
              description: 'Job result (available when completed)'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Job creation timestamp'
            },
            finishedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Job completion timestamp'
            }
          }
        },
        QueueStats: {
          type: 'object',
          properties: {
            waiting: {
              type: 'integer',
              description: 'Number of jobs waiting to be processed'
            },
            active: {
              type: 'integer',
              description: 'Number of jobs currently being processed'
            },
            completed: {
              type: 'integer',
              description: 'Number of completed jobs'
            },
            failed: {
              type: 'integer',
              description: 'Number of failed jobs'
            },
            total: {
              type: 'integer',
              description: 'Total number of jobs'
            }
          }
        },
        EmailAccount: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Account ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Gmail address'
            },
            dailyCount: {
              type: 'integer',
              description: 'Emails sent today'
            },
            dailyLimit: {
              type: 'integer',
              description: 'Daily sending limit'
            },
            remainingToday: {
              type: 'integer',
              description: 'Remaining emails for today'
            },
            isAvailable: {
              type: 'boolean',
              description: 'Whether account is available for sending'
            }
          }
        }
      },
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js'], // Đường dẫn đến file routes chứa JSDoc comments
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
  swaggerOptions: {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1976d2; }
      .swagger-ui .info .description { font-size: 14px; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 15px; border-radius: 4px; }
    `,
    customSiteTitle: 'Bulk Email Server API - Documentation'
  }
};
