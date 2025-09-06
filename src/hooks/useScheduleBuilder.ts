import { useState, useCallback, useEffect } from 'react'
import { toast } from '@/lib/toast'
import { useInventorySSE } from './useInventorySSE'

export interface Show {
  id: string
  name: string
  host: string
  category: string
  episodeCount?: number
}

export interface InventorySlot {
  id: string
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  showId: string
  showName: string
  airDate: string
  placementType: 'pre-roll' | 'mid-roll' | 'post-roll'
  price: number
  available: boolean
  estimatedImpressions?: number
}

export interface SelectedSlot extends InventorySlot {
  quantity: number
}

export function useScheduleBuilder() {
  const [selectedShows, setSelectedShows] = useState<Show[]>([])
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])
  const [inventory, setInventory] = useState<InventorySlot[]>([])
  const [loading, setLoading] = useState(false)
  
  // Real-time inventory updates via SSE
  const showIds = selectedShows.map(s => s.id)
  const { isConnected } = useInventorySSE(showIds, (data) => {
    console.log('📊 Real-time inventory update:', data)
    
    if (data.update && data.update.action) {
      const { episodeId, placementType, action, quantity } = data.update
      const slotId = `${episodeId}-${placementType}`
      
      setInventory(prev => prev.map(slot => {
        if (slot.id === slotId) {
          let newAvailable = slot.available
          
          switch (action) {
            case 'reserved':
            case 'booked':
              newAvailable = false
              toast.warning(`Slot ${placementType} for episode ${slot.episodeNumber} is no longer available`)
              break
            case 'released':
              newAvailable = true
              toast.info(`Slot ${placementType} for episode ${slot.episodeNumber} is now available`)
              break
          }
          
          return { ...slot, available: newAvailable }
        }
        return slot
      }))
      
      // Remove from selected slots if it was booked
      if (action === 'booked' || action === 'reserved') {
        setSelectedSlots(prev => prev.filter(s => s.id !== slotId))
      }
    }
  })

  // Add a show to selection
  const addShow = useCallback((show: Show) => {
    setSelectedShows(prev => {
      if (prev.find(s => s.id === show.id)) {
        toast.info('Show already selected')
        return prev
      }
      return [...prev, show]
    })
  }, [])

  // Remove a show from selection
  const removeShow = useCallback((showId: string) => {
    setSelectedShows(prev => prev.filter(s => s.id !== showId))
    // Also remove any selected slots from this show
    setSelectedSlots(prev => prev.filter(slot => slot.showId !== showId))
  }, [])

  // Load inventory for selected shows
  const loadInventory = useCallback(async () => {
    if (selectedShows.length === 0) {
      setInventory([])
      return
    }

    setLoading(true)
    try {
      // Fetch inventory for the next 90 days for selected shows
      const showIds = selectedShows.map(s => s.id)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 90)
      
      const promises = showIds.map(showId => 
        fetch(`/api/inventory?showId=${showId}&availableOnly=true&endDate=${endDate.toISOString()}`)
          .then(res => res.json())
      )
      
      const results = await Promise.all(promises)
      const allInventory = results.flatMap(result => {
        // Safely extract inventory array from response
        const inventoryItems = Array.isArray(result) ? result : 
                              Array.isArray(result?.inventory) ? result.inventory : []
        
        return inventoryItems.flatMap((item: any) => {
          // Ensure item is valid
          if (!item || typeof item !== 'object') return []
          
          const slots = []
          
          // Create separate entries for each placement type if available
          if (item.preRollAvailable > 0) {
            slots.push({
              id: `${item.episodeId}-pre-roll`,
              episodeId: item.episodeId,
              episodeTitle: item.episodeTitle || `Episode ${item.episodeNumber || 'TBD'}`,
              episodeNumber: item.episodeNumber || 0,
              showId: item.showId,
              showName: item.showName || 'Unknown Show',
              airDate: item.airDate || item.date || new Date().toISOString(),
              placementType: 'pre-roll' as const,
              price: item.preRollPrice || 0,
              available: true,
              estimatedImpressions: item.estimatedImpressions || 0
            })
          }
          
          if (item.midRollAvailable > 0) {
            slots.push({
              id: `${item.episodeId}-mid-roll`,
              episodeId: item.episodeId,
              episodeTitle: item.episodeTitle || `Episode ${item.episodeNumber || 'TBD'}`,
              episodeNumber: item.episodeNumber || 0,
              showId: item.showId,
              showName: item.showName || 'Unknown Show',
              airDate: item.airDate || item.date || new Date().toISOString(),
              placementType: 'mid-roll' as const,
              price: item.midRollPrice || 0,
              available: true,
              estimatedImpressions: item.estimatedImpressions || 0
            })
          }
          
          if (item.postRollAvailable > 0) {
            slots.push({
              id: `${item.episodeId}-post-roll`,
              episodeId: item.episodeId,
              episodeTitle: item.episodeTitle || `Episode ${item.episodeNumber || 'TBD'}`,
              episodeNumber: item.episodeNumber || 0,
              showId: item.showId,
              showName: item.showName || 'Unknown Show',
              airDate: item.airDate || item.date || new Date().toISOString(),
              placementType: 'post-roll' as const,
              price: item.postRollPrice || 0,
              available: true,
              estimatedImpressions: item.estimatedImpressions || 0
            })
          }
          
          return slots
        })
      })
      
      setInventory(allInventory)
    } catch (error) {
      console.error('Failed to load inventory:', error)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [selectedShows])

  // Add a slot to the schedule
  const addSlot = useCallback((slot: InventorySlot) => {
    setSelectedSlots(prev => {
      const existing = prev.find(s => s.id === slot.id)
      if (existing) {
        // Increment quantity
        return prev.map(s => 
          s.id === slot.id 
            ? { ...s, quantity: s.quantity + 1 }
            : s
        )
      }
      // Add new slot
      return [...prev, { ...slot, quantity: 1 }]
    })
    toast.success('Added to schedule')
  }, [])

  // Remove a slot from the schedule
  const removeSlot = useCallback((slotId: string) => {
    setSelectedSlots(prev => {
      const existing = prev.find(s => s.id === slotId)
      if (existing && existing.quantity > 1) {
        // Decrement quantity
        return prev.map(s => 
          s.id === slotId 
            ? { ...s, quantity: s.quantity - 1 }
            : s
        )
      }
      // Remove slot entirely
      return prev.filter(s => s.id !== slotId)
    })
  }, [])

  // Move a slot to a new date
  const moveSlot = useCallback((slotId: string, newDate: Date) => {
    setSelectedSlots(prev => prev.map(slot => {
      if (slot.id === slotId) {
        return {
          ...slot,
          airDate: newDate.toISOString()
        }
      }
      return slot
    }))
    toast.success('Slot moved successfully')
  }, [])

  // Calculate total price
  const getTotalPrice = useCallback(() => {
    return selectedSlots.reduce((total, slot) => 
      total + (slot.price * slot.quantity), 0
    )
  }, [selectedSlots])

  // Get total slot count
  const getSlotCount = useCallback(() => {
    return selectedSlots.reduce((total, slot) => 
      total + slot.quantity, 0
    )
  }, [selectedSlots])

  // Group slots by show
  const getSlotsByShow = useCallback(() => {
    const grouped: Record<string, SelectedSlot[]> = {}
    selectedSlots.forEach(slot => {
      if (!grouped[slot.showId]) {
        grouped[slot.showId] = []
      }
      grouped[slot.showId].push(slot)
    })
    return grouped
  }, [selectedSlots])

  // Group slots by date
  const getSlotsByDate = useCallback(() => {
    const grouped: Record<string, SelectedSlot[]> = {}
    selectedSlots.forEach(slot => {
      const date = new Date(slot.airDate).toISOString().split('T')[0]
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(slot)
    })
    return grouped
  }, [selectedSlots])

  return {
    selectedShows,
    selectedSlots,
    inventory,
    loading,
    addShow,
    removeShow,
    addSlot,
    removeSlot,
    moveSlot,
    loadInventory,
    getTotalPrice,
    getSlotCount,
    getSlotsByShow,
    getSlotsByDate
  }
}