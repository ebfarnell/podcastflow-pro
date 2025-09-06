export { emailService, EmailService } from './email-service'
export { EmailQueueService } from './queue-service'
export { EmailTemplateService } from './template-service'
export type { 
  EmailOptions, 
  EmailResult, 
  EmailProvider, 
  EmailProviderConfig,
  EmailQuota,
  EmailStatistics,
  EmailProviderError 
} from './providers/types'
export type { EmailTemplate, RenderedTemplate } from './template-service'