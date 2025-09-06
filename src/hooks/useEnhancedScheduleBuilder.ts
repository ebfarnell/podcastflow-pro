import { useState, useCallback, useEffect } from 'react'
import { toast } from '@/lib/toast'
import { useInventorySSE } from './useInventorySSE'

export interface ShowWithConfig {
  id: string
  name: string
  host: string
  category: string
  episodeCount?: number
  configurations: ShowConfiguration[]
  restrictions: ShowRestriction[]
}

export interface ShowConfiguration {
  id: string
  showId: string
  name: string
  episodeLength: number
  adLoadType: string
  preRollSlots: number
  midRollSlots: number
  postRollSlots: number
  preRollDuration: number
  midRollDuration: number
  postRollDuration: number
  releaseDays: string[]
  releaseTime: string
  isActive: boolean
  rateCard?: RateCard
}

export interface RateCard {
  id: string
  preRollBaseRate: number
  midRollBaseRate: number
  postRollBaseRate: number
  volumeDiscounts: VolumeDiscount[]
  seasonalMultipliers: Record<string, number>
  dayOfWeekMultipliers: Record<string, number>
  effectiveDate: string
  expiryDate?: string
  status: string
}

export interface VolumeDiscount {
  minSlots: number
  discount: number
}

export interface ShowRestriction {
  id: string
  showId: string
  restrictionType: string
  category?: string
  advertiserId?: string
  startDate?: string
  endDate?: string
}

export interface EnhancedInventorySlot {
  id: string
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  showId: string
  showName: string
  showCategory: string
  configurationId: string
  configurationName: string
  episodeLength: number
  airDate: string
  placementType: 'pre-roll' | 'mid-roll' | 'post-roll'
  slotNumber: number
  basePrice: number
  adjustedPrice: number
  available: boolean
  estimatedImpressions?: number
  restrictions?: ShowRestriction[]
}

export interface ScheduleItem extends EnhancedInventorySlot {
  scheduleItemId: string
  rateCardPrice: number
  negotiatedPrice: number
  quantity: number
  conflictStatus?: string
  conflictDetails?: any
}

export interface Schedule {
  id: string
  name: string
  campaignId?: string
  advertiserId: string
  agencyId?: string
  status: string
  startDate: string
  endDate: string
  totalBudget?: number
  totalSpots: number
  totalImpressions: number
  rateCardValue: number
  discountAmount: number
  valueAddAmount: number
  netAmount: number
  items: ScheduleItem[]
}

export function useEnhancedScheduleBuilder(scheduleId?: string) {
  const [selectedShows, setSelectedShows] = useState<ShowWithConfig[]>([])
  const [selectedItems, setSelectedItems] = useState<ScheduleItem[]>([])
  const [inventory, setInventory] = useState<EnhancedInventorySlot[]>([])
  const [loading, setLoading] = useState(false)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [filters, setFilters] = useState({
    dateRange: { start: new Date(), end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    categories: [] as string[],
    minImpressions: 0,
    maxPrice: null as number | null
  })

  // Real-time inventory updates via SSE
  const showIds = selectedShows.map(s => s.id)
  const { isConnected } = useInventorySSE(showIds, (data) => {
    console.log('📊 Real-time inventory update:', data)
    
    if (data.update && data.update.action) {
      const { episodeId, placementType, slotNumber, action } = data.update
      const slotId = `${episodeId}-${placementType}-${slotNumber}`
      
      setInventory(prev => prev.map(slot => {
        if (slot.id === slotId) {
          let newAvailable = slot.available
          
          switch (action) {
            case 'reserved':
            case 'booked':
              newAvailable = false
              toast.warning(`Slot no longer available: ${slot.showName} - ${slot.episodeTitle}`)
              break
            case 'released':
              newAvailable = true
              toast.info(`Slot now available: ${slot.showName} - ${slot.episodeTitle}`)
              break
          }
          
          return { ...slot, available: newAvailable }
        }
        return slot
      }))
      
      // Remove from selected items if it was booked
      if (action === 'booked' || action === 'reserved') {
        setSelectedItems(prev => prev.filter(s => s.id !== slotId))
      }
    }
  })

  // Load existing schedule if scheduleId provided
  useEffect(() => {
    if (scheduleId) {
      loadSchedule(scheduleId)
    }
  }, [scheduleId])

  // Load schedule details
  const loadSchedule = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/schedules/${id}`)
      const data = await response.json()
      
      if (data.schedule) {
        setSchedule(data.schedule)
        
        // Load shows from schedule items
        // First, extract unique shows from the items (which already include show data)
        const showsMap = new Map()
        data.items.forEach((item: any) => {
          if (item.show && !showsMap.has(item.show.id)) {
            showsMap.set(item.show.id, item.show)
          }
        })
        
        const uniqueShows = Array.from(showsMap.values())
        
        // If we have embedded show data, use it
        if (uniqueShows.length > 0) {
          setSelectedShows(uniqueShows)
        } else {
          // Fallback to fetching shows if not embedded
          const uniqueShowIds = [...new Set(data.items.map((i: any) => i.showId))]
          const showPromises = uniqueShowIds.map(showId => 
            fetch(`/api/shows/${showId}`).then(r => r.json()).catch(() => null)
          )
          
          const showsData = await Promise.all(showPromises)
          setSelectedShows(showsData.map((d: any) => d?.show).filter(Boolean))
        }
        
        // Convert items to selected items
        setSelectedItems(data.items.map((item: any) => ({
          ...item,
          id: `${item.episodeId}-${item.placementType}-${item.slotNumber}`,
          scheduleItemId: item.id,
          quantity: 1
        })))
      }
    } catch (error) {
      console.error('Failed to load schedule:', error)
      toast.error('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }, [])

  // Add a show to selection
  const addShow = useCallback(async (show: ShowWithConfig) => {
    if (selectedShows.find(s => s.id === show.id)) {
      toast.info('Show already selected')
      return
    }

    // Load show configurations
    try {
      const response = await fetch(`/api/shows/${show.id}/configurations`)
      const data = await response.json()
      
      const showWithConfig = {
        ...show,
        configurations: data.configurations || []
      }
      
      setSelectedShows(prev => [...prev, showWithConfig])
    } catch (error) {
      console.error('Failed to load show configurations:', error)
      toast.error('Failed to load show configurations')
    }
  }, [selectedShows])

  // Remove a show from selection
  const removeShow = useCallback((showId: string) => {
    setSelectedShows(prev => prev.filter(s => s.id !== showId))
    // Also remove any selected items from this show
    setSelectedItems(prev => prev.filter(item => item.showId !== showId))
  }, [])

  // Load inventory for selected shows
  const loadInventory = useCallback(async () => {
    if (selectedShows.length === 0) {
      setInventory([])
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        showIds: selectedShows.map(s => s.id).join(','),
        startDate: filters.dateRange.start.toISOString().split('T')[0],
        endDate: filters.dateRange.end.toISOString().split('T')[0]
      })

      if (filters.categories.length > 0) {
        params.append('categories', filters.categories.join(','))
      }
      if (filters.minImpressions > 0) {
        params.append('minImpressions', filters.minImpressions.toString())
      }
      if (filters.maxPrice) {
        params.append('maxPrice', filters.maxPrice.toString())
      }

      const response = await fetch(`/api/inventory/enhanced?${params}`)
      const data = await response.json()
      
      // Transform inventory data into slots
      const slots: EnhancedInventorySlot[] = []
      
      data.inventory?.forEach((item: any) => {
        // Create slots for each placement type
        if (item.preRollAvailable > 0) {
          for (let slot = 1; slot <= item.preRollAvailable; slot++) {
            slots.push({
              id: `${item.episodeId}-pre-roll-${slot}`,
              episodeId: item.episodeId,
              episodeTitle: item.episodeTitle,
              episodeNumber: item.episodeNumber,
              showId: item.showId,
              showName: item.showName,
              showCategory: item.showCategory,
              configurationId: item.configurationId,
              configurationName: item.configurationName,
              episodeLength: item.episodeLength,
              airDate: item.airDate,
              placementType: 'pre-roll',
              slotNumber: slot,
              basePrice: item.preRollBaseRate,
              adjustedPrice: item.preRollAdjustedPrice,
              available: true,
              estimatedImpressions: item.estimatedImpressions,
              restrictions: item.restrictions
            })
          }
        }

        if (item.midRollAvailable > 0) {
          for (let slot = 1; slot <= item.midRollAvailable; slot++) {
            slots.push({
              id: `${item.episodeId}-mid-roll-${slot}`,
              episodeId: item.episodeId,
              episodeTitle: item.episodeTitle,
              episodeNumber: item.episodeNumber,
              showId: item.showId,
              showName: item.showName,
              showCategory: item.showCategory,
              configurationId: item.configurationId,
              configurationName: item.configurationName,
              episodeLength: item.episodeLength,
              airDate: item.airDate,
              placementType: 'mid-roll',
              slotNumber: slot,
              basePrice: item.midRollBaseRate,
              adjustedPrice: item.midRollAdjustedPrice,
              available: true,
              estimatedImpressions: item.estimatedImpressions,
              restrictions: item.restrictions
            })
          }
        }

        if (item.postRollAvailable > 0) {
          for (let slot = 1; slot <= item.postRollAvailable; slot++) {
            slots.push({
              id: `${item.episodeId}-post-roll-${slot}`,
              episodeId: item.episodeId,
              episodeTitle: item.episodeTitle,
              episodeNumber: item.episodeNumber,
              showId: item.showId,
              showName: item.showName,
              showCategory: item.showCategory,
              configurationId: item.configurationId,
              configurationName: item.configurationName,
              episodeLength: item.episodeLength,
              airDate: item.airDate,
              placementType: 'post-roll',
              slotNumber: slot,
              basePrice: item.postRollBaseRate,
              adjustedPrice: item.postRollAdjustedPrice,
              available: true,
              estimatedImpressions: item.estimatedImpressions,
              restrictions: item.restrictions
            })
          }
        }
      })
      
      setInventory(slots)
    } catch (error) {
      console.error('Failed to load inventory:', error)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [selectedShows, filters])

  // Add an item to the schedule
  const addItem = useCallback((slot: EnhancedInventorySlot, negotiatedPrice?: number) => {
    const scheduleItem: ScheduleItem = {
      ...slot,
      scheduleItemId: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rateCardPrice: slot.basePrice,
      negotiatedPrice: negotiatedPrice || slot.adjustedPrice,
      quantity: 1
    }

    setSelectedItems(prev => {
      const existing = prev.find(s => s.id === slot.id)
      if (existing) {
        toast.info('Slot already added')
        return prev
      }
      return [...prev, scheduleItem]
    })
    
    toast.success('Added to schedule')
  }, [])

  // Remove an item from the schedule
  const removeItem = useCallback((itemId: string) => {
    setSelectedItems(prev => prev.filter(s => s.id !== itemId))
  }, [])

  // Update item pricing
  const updateItemPrice = useCallback((itemId: string, negotiatedPrice: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, negotiatedPrice } : item
    ))
  }, [])

  // Calculate totals
  const getTotals = useCallback(() => {
    const stats = selectedItems.reduce((acc, item) => ({
      spots: acc.spots + item.quantity,
      impressions: acc.impressions + (item.estimatedImpressions || 0) * item.quantity,
      rateCardValue: acc.rateCardValue + item.rateCardPrice * item.quantity,
      netAmount: acc.netAmount + item.negotiatedPrice * item.quantity
    }), { spots: 0, impressions: 0, rateCardValue: 0, netAmount: 0 })

    return {
      ...stats,
      discountAmount: stats.rateCardValue - stats.netAmount,
      discountPercent: stats.rateCardValue > 0 
        ? ((stats.rateCardValue - stats.netAmount) / stats.rateCardValue) * 100 
        : 0
    }
  }, [selectedItems])

  // Calculate volume discounts
  const getVolumeDiscount = useCallback((showId: string) => {
    const showItems = selectedItems.filter(item => item.showId === showId)
    const totalSlots = showItems.reduce((sum, item) => sum + item.quantity, 0)

    // Get rate card for the show
    const show = selectedShows.find(s => s.id === showId)
    if (!show || !show.configurations[0]?.rateCard?.volumeDiscounts) {
      return 0
    }

    const discounts = show.configurations[0].rateCard.volumeDiscounts
      .sort((a, b) => b.minSlots - a.minSlots)

    for (const discount of discounts) {
      if (totalSlots >= discount.minSlots) {
        return discount.discount
      }
    }

    return 0
  }, [selectedItems, selectedShows])

  // Save schedule
  const saveSchedule = useCallback(async (scheduleData: Partial<Schedule>) => {
    try {
      const isUpdate = !!schedule?.id

      const response = await fetch(
        isUpdate ? `/api/schedules/${schedule.id}` : '/api/schedules',
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData)
        }
      )

      if (!response.ok) {
        throw new Error('Failed to save schedule')
      }

      const data = await response.json()
      setSchedule(data.schedule)

      // Save items if this is a new schedule
      if (!isUpdate && selectedItems.length > 0) {
        const itemsToSave = selectedItems.map(item => ({
          showId: item.showId,
          showConfigurationId: item.configurationId,
          episodeId: item.episodeId,
          airDate: item.airDate,
          placementType: item.placementType,
          slotNumber: item.slotNumber,
          negotiatedPrice: item.negotiatedPrice,
          impressions: item.estimatedImpressions,
          notes: ''
        }))

        await fetch(`/api/schedules/${data.schedule.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToSave })
        })
      }

      toast.success('Schedule saved successfully')
      return data.schedule
    } catch (error) {
      console.error('Failed to save schedule:', error)
      toast.error('Failed to save schedule')
      throw error
    }
  }, [schedule, selectedItems])

  // Export schedule
  const exportSchedule = useCallback(async (format: 'pdf' | 'xlsx') => {
    if (!schedule?.id) {
      toast.error('Please save the schedule first')
      return
    }

    try {
      const response = await fetch(`/api/schedules/${schedule.id}/export?format=${format}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedule-${schedule.name}-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`Schedule exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export schedule')
    }
  }, [schedule])

  return {
    // State
    selectedShows,
    selectedItems,
    inventory,
    loading,
    schedule,
    filters,

    // Actions
    addShow,
    removeShow,
    loadInventory,
    addItem,
    removeItem,
    updateItemPrice,
    setFilters,
    saveSchedule,
    exportSchedule,

    // Calculations
    getTotals,
    getVolumeDiscount,
    isConnected
  }
}