import { 
  checkInventoryAvailability, 
  checkMultipleSpotAllowance,
  InventoryStatus,
  BulkPlacementCandidate 
} from './availability-checker'
import { 
  eachDayOfInterval, 
  isWithinInterval, 
  getDay,
  startOfWeek,
  endOfWeek,
  isSameWeek,
  format
} from 'date-fns'

export type FallbackStrategy = 'strict' | 'relaxed' | 'fill_anywhere'

export interface BulkAllocationInput {
  campaignId?: string
  advertiserId: string
  agencyId?: string
  showIds: string[]
  dateRange: {
    start: Date
    end: Date
  }
  weekdays: number[] // 0 = Sunday, 6 = Saturday
  placementTypes: string[]
  spotsRequested: number
  spotsPerWeek?: number // If provided, will try to distribute evenly per week
  allowMultiplePerShowPerDay: boolean
  fallbackStrategy: FallbackStrategy
  maxSpotsPerShowPerDay?: number
}

export interface PlacementResult {
  showId: string
  showName?: string
  date: Date
  placementType: string
  rate: number
  episodeId?: string
}

export interface PlacementConflict {
  showId: string
  showName?: string
  date: Date
  placementType: string
  reason: string
  conflictType?: 'sold' | 'held' | 'reserved' | 'competitive' | 'no_inventory' | 'max_spots_reached'
}

export interface AllocationResult {
  wouldPlace: PlacementResult[]
  conflicts: PlacementConflict[]
  summary: {
    requested: number
    placeable: number
    unplaceable: number
    byPlacementType: Record<string, { requested: number; placed: number }>
    byShow: Record<string, { requested: number; placed: number }>
    byWeek: Record<string, { requested: number; placed: number }>
  }
}

/**
 * Allocate bulk spots with inventory awareness
 */
export async function allocateBulkSpots(
  orgSlug: string,
  input: BulkAllocationInput,
  showsMetadata?: Array<{ id: string; name: string }>
): Promise<AllocationResult> {
  const placements: PlacementResult[] = []
  const conflicts: PlacementConflict[] = []
  const placedTracker = new Set<string>() // Track placed spots to avoid duplicates
  
  // Initialize tracking
  const byPlacementType: Record<string, { requested: number; placed: number }> = {}
  const byShow: Record<string, { requested: number; placed: number }> = {}
  const byWeek: Record<string, { requested: number; placed: number }> = {}
  
  input.placementTypes.forEach(pt => {
    byPlacementType[pt] = { requested: 0, placed: 0 }
  })
  
  input.showIds.forEach(showId => {
    byShow[showId] = { requested: 0, placed: 0 }
  })
  
  // Build candidate list
  const candidates: BulkPlacementCandidate[] = []
  const allDays = eachDayOfInterval({ 
    start: input.dateRange.start, 
    end: input.dateRange.end 
  })
  
  // Filter by weekdays and build candidates
  for (const day of allDays) {
    const dayOfWeek = getDay(day)
    if (!input.weekdays.includes(dayOfWeek)) continue
    
    for (const showId of input.showIds) {
      for (const placementType of input.placementTypes) {
        candidates.push({
          showId,
          date: day,
          placementType
        })
      }
    }
  }
  
  // Sort candidates for stable, deterministic ordering
  // Primary: date, Secondary: show order, Tertiary: placement type
  candidates.sort((a, b) => {
    const dateCompare = a.date.getTime() - b.date.getTime()
    if (dateCompare !== 0) return dateCompare
    
    const showIndexA = input.showIds.indexOf(a.showId)
    const showIndexB = input.showIds.indexOf(b.showId)
    if (showIndexA !== showIndexB) return showIndexA - showIndexB
    
    const placementIndexA = input.placementTypes.indexOf(a.placementType)
    const placementIndexB = input.placementTypes.indexOf(b.placementType)
    return placementIndexA - placementIndexB
  })
  
  // Calculate distribution targets
  const spotsPerPlacementType = Math.ceil(input.spotsRequested / input.placementTypes.length)
  const spotsPerShow = Math.ceil(input.spotsRequested / input.showIds.length)
  
  // Track allocation state
  const showDailySpotCount = new Map<string, number>() // "showId:date" -> count
  const placementTypeCount = new Map<string, number>()
  const showCount = new Map<string, number>()
  
  // Initialize counters
  input.placementTypes.forEach(pt => placementTypeCount.set(pt, 0))
  input.showIds.forEach(sid => showCount.set(sid, 0))
  
  // Helper to get week key
  const getWeekKey = (date: Date): string => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    return format(weekStart, 'yyyy-MM-dd')
  }
  
  // Initialize week tracking
  const weekKeys = new Set<string>()
  allDays.forEach(day => {
    if (input.weekdays.includes(getDay(day))) {
      const weekKey = getWeekKey(day)
      weekKeys.add(weekKey)
      if (!byWeek[weekKey]) {
        byWeek[weekKey] = { requested: 0, placed: 0 }
      }
    }
  })
  
  // Calculate spots per week if specified
  if (input.spotsPerWeek) {
    weekKeys.forEach(weekKey => {
      byWeek[weekKey].requested = input.spotsPerWeek!
    })
  } else {
    // Distribute evenly across weeks
    const spotsPerWeekCalculated = Math.ceil(input.spotsRequested / weekKeys.size)
    weekKeys.forEach(weekKey => {
      byWeek[weekKey].requested = spotsPerWeekCalculated
    })
  }
  
  // Update requested counts
  input.placementTypes.forEach(pt => {
    byPlacementType[pt].requested = spotsPerPlacementType
  })
  input.showIds.forEach(sid => {
    byShow[sid].requested = spotsPerShow
  })
  
  // Phase 1: Try to place with primary candidates (round-robin for even distribution)
  let spotsPlaced = 0
  let candidateIndex = 0
  const maxIterations = candidates.length * 2 // Prevent infinite loops
  let iterations = 0
  
  while (spotsPlaced < input.spotsRequested && iterations < maxIterations) {
    iterations++
    
    // Round-robin through candidates
    const candidate = candidates[candidateIndex % candidates.length]
    candidateIndex++
    
    // Skip if we've already placed this exact spot
    const spotKey = `${candidate.showId}:${format(candidate.date, 'yyyy-MM-dd')}:${candidate.placementType}`
    if (placedTracker.has(spotKey)) continue
    
    // Check daily limit for this show
    const dailyKey = `${candidate.showId}:${format(candidate.date, 'yyyy-MM-dd')}`
    const dailyCount = showDailySpotCount.get(dailyKey) || 0
    
    if (!input.allowMultiplePerShowPerDay && dailyCount >= 1) {
      continue // Skip this candidate, already has a spot today
    }
    
    if (input.allowMultiplePerShowPerDay && input.maxSpotsPerShowPerDay) {
      if (dailyCount >= input.maxSpotsPerShowPerDay) {
        continue // Hit max spots for this show/day
      }
    }
    
    // Check placement type limit (for even distribution)
    const ptCount = placementTypeCount.get(candidate.placementType) || 0
    if (ptCount >= spotsPerPlacementType) {
      continue // This placement type has enough spots
    }
    
    // Check show limit (for even distribution)
    const sCount = showCount.get(candidate.showId) || 0
    if (sCount >= spotsPerShow) {
      continue // This show has enough spots
    }
    
    // Check week limit if spotsPerWeek is specified
    const weekKey = getWeekKey(candidate.date)
    if (input.spotsPerWeek && byWeek[weekKey].placed >= input.spotsPerWeek) {
      continue // This week is full
    }
    
    // Check inventory availability
    const availability = await checkInventoryAvailability(
      orgSlug,
      {
        showId: candidate.showId,
        date: candidate.date,
        placementType: candidate.placementType
      },
      {
        campaignId: input.campaignId,
        advertiserId: input.advertiserId,
        includeHolds: true
      }
    )
    
    if (availability.available) {
      // Add to placements
      const showName = showsMetadata?.find(s => s.id === candidate.showId)?.name
      
      placements.push({
        showId: candidate.showId,
        showName,
        date: candidate.date,
        placementType: candidate.placementType,
        rate: availability.rate || 0,
        episodeId: availability.episodeId
      })
      
      // Update trackers
      placedTracker.add(spotKey)
      showDailySpotCount.set(dailyKey, dailyCount + 1)
      placementTypeCount.set(candidate.placementType, ptCount + 1)
      showCount.set(candidate.showId, sCount + 1)
      
      // Update summaries
      byPlacementType[candidate.placementType].placed++
      byShow[candidate.showId].placed++
      byWeek[weekKey].placed++
      
      spotsPlaced++
    } else if (input.fallbackStrategy === 'strict') {
      // In strict mode, record conflict
      const showName = showsMetadata?.find(s => s.id === candidate.showId)?.name
      
      conflicts.push({
        showId: candidate.showId,
        showName,
        date: candidate.date,
        placementType: candidate.placementType,
        reason: availability.reason || 'Inventory not available',
        conflictType: availability.conflictDetails?.type
      })
    }
  }
  
  // Phase 2: Handle remaining spots based on fallback strategy
  const remainingSpots = input.spotsRequested - spotsPlaced
  
  if (remainingSpots > 0 && input.fallbackStrategy !== 'strict') {
    // Relaxed or fill_anywhere strategy
    const fallbackCandidates: BulkPlacementCandidate[] = []
    
    if (input.fallbackStrategy === 'relaxed') {
      // Try other dates within the same shows
      for (const day of allDays) {
        const dayOfWeek = getDay(day)
        if (!input.weekdays.includes(dayOfWeek)) continue
        
        for (const showId of input.showIds) {
          for (const placementType of input.placementTypes) {
            const spotKey = `${showId}:${format(day, 'yyyy-MM-dd')}:${placementType}`
            if (!placedTracker.has(spotKey)) {
              fallbackCandidates.push({
                showId,
                date: day,
                placementType
              })
            }
          }
        }
      }
    } else if (input.fallbackStrategy === 'fill_anywhere') {
      // Expand to any available inventory in the org
      // For now, we'll stick to the selected shows but remove other constraints
      for (const day of allDays) {
        for (const showId of input.showIds) {
          for (const placementType of input.placementTypes) {
            const spotKey = `${showId}:${format(day, 'yyyy-MM-dd')}:${placementType}`
            if (!placedTracker.has(spotKey)) {
              fallbackCandidates.push({
                showId,
                date: day,
                placementType
              })
            }
          }
        }
      }
    }
    
    // Sort fallback candidates by date proximity to original range
    fallbackCandidates.sort((a, b) => a.date.getTime() - b.date.getTime())
    
    // Try to place remaining spots
    for (const candidate of fallbackCandidates) {
      if (spotsPlaced >= input.spotsRequested) break
      
      const spotKey = `${candidate.showId}:${format(candidate.date, 'yyyy-MM-dd')}:${candidate.placementType}`
      if (placedTracker.has(spotKey)) continue
      
      // Check daily limit
      const dailyKey = `${candidate.showId}:${format(candidate.date, 'yyyy-MM-dd')}`
      const dailyCount = showDailySpotCount.get(dailyKey) || 0
      
      if (!input.allowMultiplePerShowPerDay && dailyCount >= 1) continue
      if (input.allowMultiplePerShowPerDay && input.maxSpotsPerShowPerDay && dailyCount >= input.maxSpotsPerShowPerDay) continue
      
      // Check inventory
      const availability = await checkInventoryAvailability(
        orgSlug,
        {
          showId: candidate.showId,
          date: candidate.date,
          placementType: candidate.placementType
        },
        {
          campaignId: input.campaignId,
          advertiserId: input.advertiserId,
          includeHolds: true
        }
      )
      
      if (availability.available) {
        const showName = showsMetadata?.find(s => s.id === candidate.showId)?.name
        const weekKey = getWeekKey(candidate.date)
        
        placements.push({
          showId: candidate.showId,
          showName,
          date: candidate.date,
          placementType: candidate.placementType,
          rate: availability.rate || 0,
          episodeId: availability.episodeId
        })
        
        placedTracker.add(spotKey)
        showDailySpotCount.set(dailyKey, dailyCount + 1)
        
        // Update summaries
        byPlacementType[candidate.placementType].placed++
        byShow[candidate.showId].placed++
        if (byWeek[weekKey]) {
          byWeek[weekKey].placed++
        } else {
          byWeek[weekKey] = { requested: 0, placed: 1 }
        }
        
        spotsPlaced++
      }
    }
  }
  
  // Record final conflicts for unplaced spots
  const finalRemaining = input.spotsRequested - spotsPlaced
  if (finalRemaining > 0) {
    // Add a summary conflict entry
    conflicts.push({
      showId: '',
      date: new Date(),
      placementType: '',
      reason: `Could not place ${finalRemaining} spot(s) due to inventory constraints`,
      conflictType: 'no_inventory'
    })
  }
  
  return {
    wouldPlace: placements,
    conflicts,
    summary: {
      requested: input.spotsRequested,
      placeable: placements.length,
      unplaceable: input.spotsRequested - placements.length,
      byPlacementType,
      byShow,
      byWeek
    }
  }
}