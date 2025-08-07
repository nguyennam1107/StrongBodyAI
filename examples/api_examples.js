const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/email';

// Example 1: Send a single email
async function sendSingleEmail() {
  try {
    console.log('🚀 Sending single email...');
    
    const response = await axios.post(`${API_BASE_URL}/send`, {
      to: 'recipient@example.com',
      subject: 'Welcome {{name}}!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome {{name}}!</h1>
          <p>Thank you for joining our service. We're excited to have you on board!</p>
          <p>Best regards,<br>The Team</p>
        </div>
      `,
      text: 'Welcome {{name}}! Thank you for joining our service.',
      senderName: 'My Company',
      replyTo: 'noreply@mycompany.com'
    });

    console.log('✅ Single email sent:', response.data);
  } catch (error) {
    console.error('❌ Error sending single email:', error.response?.data || error.message);
  }
}

// Example 2: Send bulk emails
async function sendBulkEmails() {
  try {
    console.log('🚀 Sending bulk emails...');

    const recipients = [
      {
        email: 'user1@example.com',
        name: 'John Doe',
        firstName: 'John',
        customData: { company: 'ABC Corp', position: 'Developer' }
      },
      {
        email: 'user2@example.com',
        name: 'Jane Smith',
        firstName: 'Jane',
        customData: { company: 'XYZ Ltd', position: 'Manager' }
      },
      {
        email: 'user3@example.com',
        name: 'Bob Wilson',
        firstName: 'Bob',
        customData: { company: 'Tech Startup', position: 'CTO' }
      }
    ];

    const response = await axios.post(`${API_BASE_URL}/send-bulk`, {
      recipients,
      template: {
        subject: 'Welcome to our newsletter, {{firstName}}!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <header style="background: #f8f9fa; padding: 20px; text-align: center;">
              <h1 style="color: #333;">Welcome {{firstName}}!</h1>
            </header>
            
            <main style="padding: 20px;">
              <p>Hi {{firstName}},</p>
              
              <p>We're thrilled to welcome you to our newsletter! As a {{customData.position}} 
              at {{customData.company}}, we think you'll find our content particularly valuable.</p>
              
              <div style="background: #e7f3ff; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff;">
                <h3 style="margin: 0 0 10px 0; color: #007bff;">What to expect:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Weekly industry insights</li>
                  <li>Exclusive tips and tricks</li>
                  <li>Early access to new features</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://example.com/get-started" 
                   style="background: #007bff; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Get Started
                </a>
              </div>
              
              <p>Thanks again for joining us!</p>
              <p>Best regards,<br>The Newsletter Team</p>
            </main>
            
            <footer style="background: #f8f9fa; padding: 20px; text-align: center; 
                          font-size: 12px; color: #666;">
              <p>You received this email because you subscribed to our newsletter.</p>
              <p><a href="https://example.com/unsubscribe">Unsubscribe</a></p>
            </footer>
          </div>
        `,
        text: `Welcome {{firstName}}!
        
Hi {{firstName}},

We're thrilled to welcome you to our newsletter! As a {{customData.position}} at {{customData.company}}, we think you'll find our content particularly valuable.

What to expect:
- Weekly industry insights
- Exclusive tips and tricks  
- Early access to new features

Get started: https://example.com/get-started

Thanks again for joining us!

Best regards,
The Newsletter Team

You received this email because you subscribed to our newsletter.
Unsubscribe: https://example.com/unsubscribe`
      },
      options: {
        senderName: 'Newsletter Team',
        replyTo: 'newsletter@mycompany.com',
        priority: 5
      }
    });

    const jobId = response.data.jobId;
    console.log('✅ Bulk email job created:', response.data);

    // Monitor job progress
    await monitorJobProgress(jobId);

  } catch (error) {
    console.error('❌ Error sending bulk emails:', error.response?.data || error.message);
  }
}

// Example 3: Monitor job progress
async function monitorJobProgress(jobId) {
  console.log(`📊 Monitoring job ${jobId}...`);
  
  let completed = false;
  while (!completed) {
    try {
      const response = await axios.get(`${API_BASE_URL}/job/${jobId}`);
      const job = response.data.job;
      
      console.log(`Job ${jobId} status: ${job.state}, progress: ${job.progress}%`);
      
      if (job.state === 'completed') {
        console.log('✅ Job completed successfully!');
        console.log('Results:', job.result);
        completed = true;
      } else if (job.state === 'failed') {
        console.log('❌ Job failed:', job.result);
        completed = true;
      } else {
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('❌ Error checking job status:', error.response?.data || error.message);
      break;
    }
  }
}

// Example 4: Check service health
async function checkHealth() {
  try {
    console.log('🔍 Checking service health...');
    
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Service health:', response.data);
    
    return response.data.status === 'OK';
  } catch (error) {
    console.error('❌ Health check failed:', error.response?.data || error.message);
    return false;
  }
}

// Example 5: Get email accounts status
async function getAccountsStatus() {
  try {
    console.log('📧 Getting email accounts status...');
    
    const response = await axios.get(`${API_BASE_URL}/accounts`);
    console.log('✅ Email accounts status:', response.data);
    
  } catch (error) {
    console.error('❌ Error getting accounts status:', error.response?.data || error.message);
  }
}

// Example 6: Get predefined templates
async function getTemplates() {
  try {
    console.log('🎨 Getting predefined templates...');
    
    const response = await axios.get(`${API_BASE_URL}/templates`);
    console.log('✅ Available templates:', response.data.templates.map(t => ({
      id: t.id,
      name: t.name,
      variables: t.variables
    })));
    
  } catch (error) {
    console.error('❌ Error getting templates:', error.response?.data || error.message);
  }
}

// Example 7: Send email using predefined template
async function sendWithPredefinedTemplate() {
  try {
    console.log('🎨 Sending email with predefined template...');

    const response = await axios.post(`${API_BASE_URL}/send-bulk`, {
      recipients: [
        {
          email: 'customer@example.com',
          name: 'John Customer',
          firstName: 'John',
          customData: {
            discount: '25',
            promoCode: 'SAVE25',
            validUntil: '2024-12-31'
          }
        }
      ],
      template: {
        subject: '🎉 {{promoTitle}} - Limited Time Offer!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">🎉 Black Friday Sale</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">Limited Time Offer!</p>
            </div>
            
            <div style="padding: 30px 20px;">
              <p>Hi {{firstName}},</p>
              
              <p style="font-size: 16px; line-height: 1.6;">Don't miss out on our biggest sale of the year! Get amazing discounts on all our products.</p>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px;">
                <h2 style="color: #856404; margin: 0 0 10px 0;">Save {{customData.discount}}%!</h2>
                <p style="color: #856404; margin: 0;">Use code: <strong>{{customData.promoCode}}</strong></p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://example.com/shop" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">
                  Shop Now
                </a>
              </div>
              
              <p style="text-align: center; color: #dc3545; font-weight: bold;">
                ⏰ Offer valid until {{customData.validUntil}}
              </p>
            </div>
          </div>
        `
      },
      options: {
        senderName: 'Sales Team',
        replyTo: 'sales@mycompany.com'
      }
    });

    console.log('✅ Promotional email sent:', response.data);

  } catch (error) {
    console.error('❌ Error sending promotional email:', error.response?.data || error.message);
  }
}

// Main function to run all examples
async function runExamples() {
  console.log('🎯 Starting Bulk Email Server API Examples\n');

  // Check if server is running
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.log('❌ Server is not running or not healthy. Please start the server first.');
    return;
  }

  console.log('\n' + '='.repeat(50));
  
  // Run examples
  await getAccountsStatus();
  console.log('\n' + '='.repeat(50));
  
  await getTemplates();
  console.log('\n' + '='.repeat(50));
  
  // Uncomment these to actually send emails (make sure you have configured email accounts)
  // await sendSingleEmail();
  // console.log('\n' + '='.repeat(50));
  
  // await sendBulkEmails();
  // console.log('\n' + '='.repeat(50));
  
  // await sendWithPredefinedTemplate();
  
  console.log('\n✨ Examples completed!');
  console.log('\n📝 Note: Email sending examples are commented out by default.');
  console.log('   Uncomment them in the code after configuring your email accounts.');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  sendSingleEmail,
  sendBulkEmails,
  monitorJobProgress,
  checkHealth,
  getAccountsStatus,
  getTemplates,
  sendWithPredefinedTemplate
};
