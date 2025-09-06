import { SES } from '@aws-sdk/client-ses'
import { renderTemplate } from '@/lib/notifications/template-renderer'

// Create SES client - will use environment variables or IAM role/instance credentials
const sesConfig: any = {
  region: process.env.AWS_SES_REGION || 'us-east-1'
}

// Only add credentials if explicitly provided
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  sesConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}

const ses = new SES(sesConfig)

export interface EmailParams {
  to: string | string[]
  subject: string
  htmlBody: string
  textBody?: string
  from?: string
  replyTo?: string
  configurationSet?: string
}

export async function sendEmail(params: EmailParams): Promise<{ messageId: string }> {
  const {
    to,
    subject,
    htmlBody,
    textBody,
    from = process.env.EMAIL_FROM || 'noreply@podcastflow.pro',
    replyTo = process.env.EMAIL_REPLY_TO || 'support@podcastflow.pro',
    configurationSet = 'podcastflow-notifications'
  } = params

  const toAddresses = Array.isArray(to) ? to : [to]

  try {
    const result = await ses.sendEmail({
      Source: from,
      Destination: {
        ToAddresses: toAddresses
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: textBody ? {
            Data: textBody,
            Charset: 'UTF-8'
          } : undefined
        }
      },
      ReplyToAddresses: [replyTo],
      ConfigurationSetName: configurationSet
    })

    console.log(`📧 Email sent successfully: ${result.MessageId}`)
    return { messageId: result.MessageId || '' }
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    throw error
  }
}

export async function sendTemplatedEmail(
  to: string | string[],
  templateName: string,
  templateData: Record<string, any>,
  from?: string
): Promise<{ messageId: string }> {
  const toAddresses = Array.isArray(to) ? to : [to]

  try {
    const result = await ses.sendTemplatedEmail({
      Source: from || process.env.EMAIL_FROM || 'noreply@podcastflow.pro',
      Destination: {
        ToAddresses: toAddresses
      },
      Template: templateName,
      TemplateData: JSON.stringify(templateData),
      ConfigurationSetName: 'podcastflow-notifications'
    })

    console.log(`📧 Templated email sent: ${result.MessageId}`)
    return { messageId: result.MessageId || '' }
  } catch (error) {
    console.error('❌ Failed to send templated email:', error)
    throw error
  }
}

export async function verifyEmailAddress(email: string): Promise<boolean> {
  try {
    await ses.verifyEmailIdentity({ EmailAddress: email })
    console.log(`✅ Verification email sent to ${email}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to verify email ${email}:`, error)
    return false
  }
}

export async function checkVerificationStatus(email: string): Promise<boolean> {
  try {
    const result = await ses.getIdentityVerificationAttributes({
      Identities: [email]
    })
    
    const status = result.VerificationAttributes?.[email]?.VerificationStatus
    return status === 'Success'
  } catch (error) {
    console.error(`❌ Failed to check verification status for ${email}:`, error)
    return false
  }
}

export async function createEmailTemplate(
  name: string,
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<void> {
  try {
    await ses.createTemplate({
      Template: {
        TemplateName: name,
        SubjectPart: subject,
        HtmlPart: htmlBody,
        TextPart: textBody
      }
    })
    console.log(`✅ Email template created: ${name}`)
  } catch (error: any) {
    if (error.name === 'AlreadyExists') {
      // Update existing template
      await ses.updateTemplate({
        Template: {
          TemplateName: name,
          SubjectPart: subject,
          HtmlPart: htmlBody,
          TextPart: textBody
        }
      })
      console.log(`✅ Email template updated: ${name}`)
    } else {
      throw error
    }
  }
}