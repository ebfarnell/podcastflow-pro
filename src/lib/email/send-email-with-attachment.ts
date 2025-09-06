import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'

interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

interface SendEmailWithAttachmentParams {
  to: string | string[]
  from?: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
  replyTo?: string
}

export async function sendEmailWithAttachment({
  to,
  from = process.env.EMAIL_FROM || 'noreply@podcastflow.pro',
  subject,
  html,
  attachments = [],
  replyTo = process.env.EMAIL_REPLY_TO || 'support@podcastflow.pro'
}: SendEmailWithAttachmentParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const sesClient = new SESClient({
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1'
    })

    // Create boundary for multipart email
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
    
    // Build email headers
    const toAddresses = Array.isArray(to) ? to : [to]
    let rawEmail = [
      `From: ${from}`,
      `To: ${toAddresses.join(', ')}`,
      `Reply-To: ${replyTo}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      html,
      ''
    ].join('\r\n')

    // Add attachments
    for (const attachment of attachments) {
      rawEmail += [
        `--${boundary}`,
        `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        attachment.content.toString('base64'),
        ''
      ].join('\r\n')
    }

    // Close boundary
    rawEmail += `--${boundary}--\r\n`

    // Convert to buffer
    const encoder = new TextEncoder()
    const rawMessage = encoder.encode(rawEmail)

    // Send raw email
    const command = new SendRawEmailCommand({
      RawMessage: {
        Data: rawMessage
      },
      Source: from,
      Destinations: toAddresses
    })

    const response = await sesClient.send(command)
    
    console.log('✅ Email with attachment sent successfully:', response.MessageId)
    
    return {
      success: true,
      messageId: response.MessageId
    }
  } catch (error: any) {
    console.error('❌ Failed to send email with attachment:', error)
    
    return {
      success: false,
      error: error.message || 'Failed to send email'
    }
  }
}