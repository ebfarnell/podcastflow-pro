import { EmailProvider, EmailProviderConfig } from './types'
import { SESProvider } from './ses-provider'
import { SMTPProvider } from './smtp-provider'

export class EmailProviderFactory {
  static async create(config: EmailProviderConfig): Promise<EmailProvider> {
    let provider: EmailProvider

    switch (config.provider) {
      case 'ses':
        provider = new SESProvider()
        break
      case 'smtp':
        provider = new SMTPProvider()
        break
      default:
        throw new Error(`Unknown email provider: ${config.provider}`)
    }

    await provider.initialize(config)
    return provider
  }
}