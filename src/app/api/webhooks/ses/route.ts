import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

interface SESNotification {
  Type: 'Notification' | 'SubscriptionConfirmation'
  Message: string
  MessageId: string
  Timestamp: string
  Signature: string
  SigningCertURL: string
  TopicArn?: string
  SubscribeURL?: string
}

interface SESMessage {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery' | 'Send' | 'Reject' | 'Open' | 'Click'
  mail: {
    messageId: string
    source: string
    timestamp: string
    destination: string[]
  }
  bounce?: {
    bounceType: 'Permanent' | 'Transient' | 'Undetermined'
    bounceSubType: string
    bouncedRecipients: Array<{
      emailAddress: string
      status?: string
      diagnosticCode?: string
    }>
    timestamp: string
  }
  complaint?: {
    complaintFeedbackType?: string
    complainedRecipients: Array<{
      emailAddress: string
    }>
    timestamp: string
  }
  delivery?: {
    timestamp: string
    processingTimeMillis: number
    recipients: string[]
  }
}

// Verify SNS signature to ensure the webhook is from AWS
async function verifySNSSignature(notification: SESNotification): Promise<boolean> {
  // In production, implement proper SNS signature verification
  // For now, we'll check if it's from our expected topic
  if (process.env.AWS_SES_TOPIC_ARN && notification.TopicArn !== process.env.AWS_SES_TOPIC_ARN) {
    return false
  }
  return true
}

export async function POST(request: NextRequest) {
  try {
    const notification: SESNotification = await request.json()
    
    // Verify the request is from AWS SNS
    const isValid = await verifySNSSignature(notification)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    // Handle subscription confirmation
    if (notification.Type === 'SubscriptionConfirmation' && notification.SubscribeURL) {
      // In production, you would fetch this URL to confirm the subscription
      console.log('SNS Subscription Confirmation URL:', notification.SubscribeURL)
      return NextResponse.json({ message: 'Subscription URL logged' })
    }
    
    // Handle notification
    if (notification.Type === 'Notification') {
      const message: SESMessage = JSON.parse(notification.Message)
      
      switch (message.notificationType) {
        case 'Bounce':
          await handleBounce(message)
          break
          
        case 'Complaint':
          await handleComplaint(message)
          break
          
        case 'Delivery':
          await handleDelivery(message)
          break
          
        default:
          console.log(`Unhandled notification type: ${message.notificationType}`)
      }
    }
    
    return NextResponse.json({ message: 'Webhook processed' })
  } catch (error) {
    console.error('SES webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleBounce(message: SESMessage) {
  if (!message.bounce) return
  
  const messageId = message.mail.messageId
  const bounceType = message.bounce.bounceType
  const timestamp = new Date(message.bounce.timestamp)
  
  for (const recipient of message.bounce.bouncedRecipients) {
    try {
      // Find the email log by message ID
      const emailLog = await prisma.emailLog.findFirst({
        where: { 
          messageId,
          toEmail: recipient.emailAddress
        }
      })
      
      if (emailLog) {
        // Update email log
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            bouncedAt: timestamp,
            bounceType: bounceType,
            bounceReason: recipient.diagnosticCode
          }
        })
        
        // Create tracking event
        await prisma.emailTrackingEvent.create({
          data: {
            emailLogId: emailLog.id,
            eventType: 'bounce',
            timestamp,
            metadata: {
              bounceType,
              bounceSubType: message.bounce.bounceSubType,
              diagnosticCode: recipient.diagnosticCode
            }
          }
        })
      }
      
      // Add to suppression list for permanent bounces
      if (bounceType === 'Permanent') {
        await prisma.emailSuppressionList.upsert({
          where: { email: recipient.emailAddress },
          update: {
            reason: 'hard_bounce',
            metadata: {
              bounceType,
              diagnosticCode: recipient.diagnosticCode,
              lastBounceDate: timestamp.toISOString()
            }
          },
          create: {
            email: recipient.emailAddress,
            reason: 'hard_bounce',
            metadata: {
              bounceType,
              diagnosticCode: recipient.diagnosticCode,
              lastBounceDate: timestamp.toISOString()
            }
          }
        })
      }
    } catch (error) {
      console.error(`Failed to process bounce for ${recipient.emailAddress}:`, error)
    }
  }
}

async function handleComplaint(message: SESMessage) {
  if (!message.complaint) return
  
  const messageId = message.mail.messageId
  const timestamp = new Date(message.complaint.timestamp)
  
  for (const recipient of message.complaint.complainedRecipients) {
    try {
      // Find the email log
      const emailLog = await prisma.emailLog.findFirst({
        where: { 
          messageId,
          toEmail: recipient.emailAddress
        }
      })
      
      if (emailLog) {
        // Update email log
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            complainedAt: timestamp
          }
        })
        
        // Create tracking event
        await prisma.emailTrackingEvent.create({
          data: {
            emailLogId: emailLog.id,
            eventType: 'complaint',
            timestamp,
            metadata: {
              complaintType: message.complaint.complaintFeedbackType
            }
          }
        })
      }
      
      // Add to suppression list
      await prisma.emailSuppressionList.upsert({
        where: { email: recipient.emailAddress },
        update: {
          reason: 'complaint',
          metadata: {
            complaintType: message.complaint.complaintFeedbackType,
            lastComplaintDate: timestamp.toISOString()
          }
        },
        create: {
          email: recipient.emailAddress,
          reason: 'complaint',
          metadata: {
            complaintType: message.complaint.complaintFeedbackType,
            lastComplaintDate: timestamp.toISOString()
          }
        }
      })
    } catch (error) {
      console.error(`Failed to process complaint for ${recipient.emailAddress}:`, error)
    }
  }
}

async function handleDelivery(message: SESMessage) {
  if (!message.delivery) return
  
  const messageId = message.mail.messageId
  const timestamp = new Date(message.delivery.timestamp)
  
  for (const recipient of message.delivery.recipients) {
    try {
      // Find and update the email log
      const emailLog = await prisma.emailLog.findFirst({
        where: { 
          messageId,
          toEmail: recipient
        }
      })
      
      if (emailLog) {
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            deliveredAt: timestamp,
            status: 'delivered'
          }
        })
      }
    } catch (error) {
      console.error(`Failed to process delivery for ${recipient}:`, error)
    }
  }
}