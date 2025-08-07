const Handlebars = require('handlebars');
const logger = require('./logger');

// Register custom helpers
Handlebars.registerHelper('upperCase', function(str) {
  return str ? str.toUpperCase() : '';
});

Handlebars.registerHelper('lowerCase', function(str) {
  return str ? str.toLowerCase() : '';
});

Handlebars.registerHelper('capitalize', function(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
});

Handlebars.registerHelper('formatDate', function(date, format) {
  if (!date) return '';
  const d = new Date(date);
  
  switch(format) {
    case 'short':
      return d.toLocaleDateString();
    case 'long':
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    case 'time':
      return d.toLocaleTimeString();
    default:
      return d.toLocaleDateString();
  }
});

Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
  return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
});

class TemplateEngine {
  async compileTemplate(templateString, data) {
    try {
      if (!templateString) {
        return '';
      }

      const template = Handlebars.compile(templateString);
      return template(data);
    } catch (error) {
      logger.error('Template compilation error:', error);
      throw new Error(`Template compilation failed: ${error.message}`);
    }
  }

  validateTemplate(templateString) {
    try {
      Handlebars.compile(templateString);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  extractVariables(templateString) {
    try {
      const variables = new Set();
      const template = Handlebars.compile(templateString);
      
      // Parse the AST to extract variable names
      const ast = Handlebars.parse(templateString);
      this.traverseAST(ast, variables);
      
      return Array.from(variables);
    } catch (error) {
      logger.error('Error extracting template variables:', error);
      return [];
    }
  }

  traverseAST(node, variables) {
    if (node.type === 'Program') {
      node.body.forEach(child => this.traverseAST(child, variables));
    } else if (node.type === 'MustacheStatement' || node.type === 'BlockStatement') {
      if (node.path && node.path.type === 'PathExpression') {
        variables.add(node.path.original);
      }
    } else if (node.type === 'PartialStatement') {
      if (node.name && node.name.type === 'PathExpression') {
        variables.add(node.name.original);
      }
    }

    // Recursively traverse children
    if (node.program) {
      this.traverseAST(node.program, variables);
    }
    if (node.inverse) {
      this.traverseAST(node.inverse, variables);
    }
  }
}

// Pre-defined email templates
const predefinedTemplates = {
  welcome: {
    subject: 'Welcome {{name}}!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome {{name}}!</h1>
        <p>Thank you for joining us. We're excited to have you on board.</p>
        <p>Here are your account details:</p>
        <ul>
          <li>Email: {{email}}</li>
          <li>Registration Date: {{formatDate registrationDate 'long'}}</li>
        </ul>
        <p>Best regards,<br>The Team</p>
      </div>
    `,
    text: `Welcome {{name}}!
    
Thank you for joining us. We're excited to have you on board.

Account details:
- Email: {{email}}
- Registration Date: {{formatDate registrationDate 'long'}}

Best regards,
The Team`
  },

  newsletter: {
    subject: '{{newsletterTitle}} - {{formatDate date "long"}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <header style="background: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #333; margin: 0;">{{newsletterTitle}}</h1>
          <p style="color: #666; margin: 5px 0 0 0;">{{formatDate date "long"}}</p>
        </header>
        
        <main style="padding: 20px;">
          <p>Hi {{firstName}},</p>
          
          <div style="margin: 20px 0;">
            {{{content}}}
          </div>
          
          {{#if callToAction}}
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{callToAction.url}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              {{callToAction.text}}
            </a>
          </div>
          {{/if}}
        </main>
        
        <footer style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>You received this email because you're subscribed to our newsletter.</p>
          <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
        </footer>
      </div>
    `,
    text: `{{newsletterTitle}} - {{formatDate date "long"}}

Hi {{firstName}},

{{{content}}}

{{#if callToAction}}
{{callToAction.text}}: {{callToAction.url}}
{{/if}}

You received this email because you're subscribed to our newsletter.
Unsubscribe: {{unsubscribeUrl}}`
  },

  promotional: {
    subject: '🎉 {{promoTitle}} - Limited Time Offer!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🎉 {{promoTitle}}</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Limited Time Offer!</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <p>Hi {{name}},</p>
          
          <p style="font-size: 16px; line-height: 1.6;">{{description}}</p>
          
          {{#if discount}}
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px;">
            <h2 style="color: #856404; margin: 0 0 10px 0;">Save {{discount}}%!</h2>
            <p style="color: #856404; margin: 0;">Use code: <strong>{{promoCode}}</strong></p>
          </div>
          {{/if}}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ctaUrl}}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">
              {{ctaText}}
            </a>
          </div>
          
          {{#if validUntil}}
          <p style="text-align: center; color: #dc3545; font-weight: bold;">
            ⏰ Offer valid until {{formatDate validUntil "long"}}
          </p>
          {{/if}}
        </div>
      </div>
    `,
    text: `🎉 {{promoTitle}} - Limited Time Offer!

Hi {{name}},

{{description}}

{{#if discount}}
Save {{discount}}%! Use code: {{promoCode}}
{{/if}}

{{ctaText}}: {{ctaUrl}}

{{#if validUntil}}
⏰ Offer valid until {{formatDate validUntil "long"}}
{{/if}}`
  }
};

const templateEngine = new TemplateEngine();

module.exports = {
  compileTemplate: templateEngine.compileTemplate.bind(templateEngine),
  validateTemplate: templateEngine.validateTemplate.bind(templateEngine),
  extractVariables: templateEngine.extractVariables.bind(templateEngine),
  predefinedTemplates
};
