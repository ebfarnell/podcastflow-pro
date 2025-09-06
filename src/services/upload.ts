import { api } from './api'

interface UploadUrlResponse {
  uploadUrl: string
  viewUrl: string
  key: string
}

export const uploadService = {
  async getUploadUrl(fileName: string, fileType: string, fileSize: number, campaignId: string): Promise<UploadUrlResponse> {
    return api.post('/uploads/presigned-url', {
      fileName,
      fileType,
      fileSize,
      campaignId
    })
  },

  async uploadFile(file: File, uploadUrl: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }
  },

  async uploadCampaignAsset(file: File, campaignId: string): Promise<string> {
    // Get pre-signed URL
    const { uploadUrl, viewUrl } = await this.getUploadUrl(
      file.name,
      file.type,
      file.size,
      campaignId
    )

    // Upload file
    await this.uploadFile(file, uploadUrl)

    return viewUrl
  },

  validateFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg', 'audio/mp3', 'application/pdf']
    const maxSize = 50 * 1024 * 1024 // 50MB

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Allowed types: JPG, PNG, GIF, MP3, PDF' }
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'File too large. Maximum size is 50MB' }
    }

    return { valid: true }
  }
}