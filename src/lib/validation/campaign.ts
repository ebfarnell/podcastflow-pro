import { z } from 'zod'

// Campaign validation schemas
export const campaignCreateSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200),
  client: z.string().min(1, 'Client is required'),
  agency: z.string().optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled', 'lost']).optional(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().min(0, 'Budget must be positive').optional(),
  targetImpressions: z.number().min(0).optional(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  adFormats: z.array(z.string()).optional(),
})

export const campaignUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  client: z.string().min(1).optional(),
  agency: z.string().optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled', 'lost']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().min(0).optional(),
  targetImpressions: z.number().min(0).optional(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  adFormats: z.array(z.string()).optional(),
})

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>