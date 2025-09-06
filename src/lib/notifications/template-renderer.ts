export function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template
  
  // Replace all {{variable}} placeholders
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    const value = variables[key]
    
    // Handle different types of values
    let replacement = ''
    if (value === null || value === undefined) {
      replacement = ''
    } else if (typeof value === 'object') {
      replacement = JSON.stringify(value)
    } else {
      replacement = String(value)
    }
    
    rendered = rendered.replace(regex, replacement)
  })
  
  // Remove any unreplaced placeholders
  rendered = rendered.replace(/{{[^}]+}}/g, '')
  
  return rendered
}

export function createEmailHtml(content: string, actionUrl?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background: #5a67d8;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 14px;
      color: #6c757d;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PodcastFlow Pro</h1>
    </div>
    <div class="content">
      ${content}
      ${actionUrl ? `
      <div style="text-align: center;">
        <a href="${actionUrl}" class="button">View Details</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} PodcastFlow Pro. All rights reserved.</p>
      <p>
        <a href="https://app.podcastflow.pro/settings/notifications">Manage Notification Preferences</a> |
        <a href="https://podcastflow.pro">Visit Website</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}