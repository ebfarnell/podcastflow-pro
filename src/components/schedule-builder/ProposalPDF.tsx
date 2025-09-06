'use client'

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { Show, SelectedSlot } from '@/hooks/useScheduleBuilder'

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica'
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #1976d2',
    paddingBottom: 20
  },
  logo: {
    width: 150,
    marginBottom: 10
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 14,
    color: '#666666'
  },
  section: {
    marginBottom: 15
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333'
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5
  },
  label: {
    width: 120,
    fontSize: 10,
    color: '#666666'
  },
  value: {
    fontSize: 10,
    color: '#333333',
    flex: 1
  },
  table: {
    display: 'table',
    width: '100%',
    marginTop: 10
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #E0E0E0',
    minHeight: 25,
    alignItems: 'center'
  },
  tableHeader: {
    backgroundColor: '#F5F5F5',
    fontWeight: 'bold'
  },
  tableCell: {
    fontSize: 9,
    padding: 5
  },
  col1: { width: '20%' },
  col2: { width: '25%' },
  col3: { width: '20%' },
  col4: { width: '15%' },
  col5: { width: '10%' },
  col6: { width: '10%' },
  metricsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20
  },
  metricCard: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 5,
    width: '23%'
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 5
  },
  metricLabel: {
    fontSize: 10,
    color: '#666666'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#999999'
  },
  legendContainer: {
    marginBottom: 15
  },
  legendRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 5,
    minWidth: 150
  },
  legendColor: {
    width: 14,
    height: 14,
    marginRight: 8,
    borderRadius: 2
  },
  legendText: {
    fontSize: 10,
    color: '#333333',
    flex: 1
  },
  // Calendar styles
  calendarContainer: {
    marginTop: 15,
    border: '1 solid #E0E0E0'
  },
  calendarWeekDays: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottom: '2 solid #E0E0E0'
  },
  calendarWeekDay: {
    width: '14.285%',
    padding: 10,
    alignItems: 'center'
  },
  calendarWeekDayText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center'
  },
  calendarGrid: {
    display: 'flex',
    flexDirection: 'column'
  },
  calendarWeek: {
    flexDirection: 'row',
    minHeight: 70
  },
  calendarCell: {
    width: '14.285%',
    minHeight: 70,
    borderRight: '1 solid #E0E0E0',
    borderBottom: '1 solid #E0E0E0',
    padding: 3,
    position: 'relative'
  },
  calendarCellInactive: {
    backgroundColor: '#FAFAFA'
  },
  calendarDate: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#333333'
  },
  calendarSpot: {
    marginBottom: 2,
    padding: 3,
    borderRadius: 2
  },
  calendarSpotText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: 'bold'
  },
  calendarDailyTotal: {
    fontSize: 8,
    color: '#1976d2',
    fontWeight: 'bold',
    marginTop: 2
  },
  moreIndicator: {
    backgroundColor: '#757575',
    marginBottom: 2,
    padding: 3,
    borderRadius: 2
  },
  moreIndicatorText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontStyle: 'italic'
  }
})

interface ProposalPDFProps {
  campaignName: string
  campaignBudget?: number | null
  selectedShows: Show[]
  selectedSlots: SelectedSlot[]
  totalPrice: number
  organizationName?: string
  generatedDate?: Date
}

export function ProposalPDF({
  campaignName,
  campaignBudget,
  selectedShows,
  selectedSlots,
  totalPrice,
  organizationName = 'PodcastFlow Pro',
  generatedDate = new Date()
}: ProposalPDFProps) {
  // Calculate metrics
  const totalSlots = selectedSlots.reduce((sum, slot) => sum + slot.quantity, 0)
  const avgPricePerSlot = totalSlots > 0 ? totalPrice / totalSlots : 0
  const totalImpressions = selectedSlots.reduce(
    (sum, slot) => sum + (slot.estimatedImpressions || 0) * slot.quantity,
    0
  )
  const cpm = totalImpressions > 0 ? (totalPrice / totalImpressions) * 1000 : 0

  // Group slots by date
  const slotsByDate = selectedSlots.reduce((acc, slot) => {
    const date = format(new Date(slot.airDate), 'yyyy-MM-dd')
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(slot)
    return acc
  }, {} as Record<string, SelectedSlot[]>)

  const sortedDates = Object.keys(slotsByDate).sort()
  const startDate = sortedDates[0] ? new Date(sortedDates[0]) : new Date()
  const endDate = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1]) : new Date()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Campaign Proposal</Text>
          <Text style={styles.subtitle}>{organizationName}</Text>
          <Text style={styles.subtitle}>Generated on {format(generatedDate, 'MMMM d, yyyy')}</Text>
        </View>

        {/* Campaign Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campaign Overview</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Campaign Name:</Text>
            <Text style={styles.value}>{campaignName || 'Untitled Campaign'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Campaign Period:</Text>
            <Text style={styles.value}>
              {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Investment:</Text>
            <Text style={styles.value}>${totalPrice.toLocaleString()}</Text>
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsBox}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totalSlots}</Text>
              <Text style={styles.metricLabel}>Total Ad Slots</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{selectedShows.length}</Text>
              <Text style={styles.metricLabel}>Shows Selected</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{(totalImpressions / 1000).toFixed(0)}K</Text>
              <Text style={styles.metricLabel}>Est. Impressions</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>${cpm.toFixed(2)}</Text>
              <Text style={styles.metricLabel}>CPM</Text>
            </View>
          </View>
        </View>

        {/* Show Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Show Distribution</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1]}>Show</Text>
              <Text style={[styles.tableCell, styles.col2]}>Host</Text>
              <Text style={[styles.tableCell, styles.col3]}>Episodes</Text>
              <Text style={[styles.tableCell, styles.col4]}>Slots</Text>
              <Text style={[styles.tableCell, styles.col5]}>Investment</Text>
              <Text style={[styles.tableCell, styles.col6]}>% of Total</Text>
            </View>
            {selectedShows.map(show => {
              const showSlots = selectedSlots.filter(s => s.showId === show.id)
              const showEpisodes = new Set(showSlots.map(s => s.episodeId)).size
              const showTotal = showSlots.reduce((sum, slot) => sum + (slot.price * slot.quantity), 0)
              const showSlotCount = showSlots.reduce((sum, slot) => sum + slot.quantity, 0)
              const percentage = totalPrice > 0 ? (showTotal / totalPrice) * 100 : 0
              
              return (
                <View key={show.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col1]}>{show.name}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{show.host}</Text>
                  <Text style={[styles.tableCell, styles.col3]}>{showEpisodes}</Text>
                  <Text style={[styles.tableCell, styles.col4]}>{showSlotCount}</Text>
                  <Text style={[styles.tableCell, styles.col5]}>${showTotal.toLocaleString()}</Text>
                  <Text style={[styles.tableCell, styles.col6]}>{percentage.toFixed(0)}%</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This proposal is valid for 30 days from the generation date. 
          Inventory availability subject to change.
        </Text>
      </Page>

      {/* Detailed Schedule Page */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Detailed Schedule</Text>
          <Text style={styles.subtitle}>{campaignName || 'Untitled Campaign'}</Text>
        </View>

        {/* Schedule Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Broadcasting Schedule</Text>
          {selectedSlots.length > 0 ? (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { width: '15%' }]}>Date</Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>Show</Text>
                <Text style={[styles.tableCell, { width: '25%' }]}>Episode</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>Placement</Text>
                <Text style={[styles.tableCell, { width: '10%' }]}>Qty</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>Price</Text>
              </View>
              {sortedDates.map(date => {
                const slotsForDate = slotsByDate[date]
                return slotsForDate.map((slot, index) => (
                  <View key={`${date}-${slot.id || index}`} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '15%' }]}>
                      {index === 0 ? format(new Date(date), 'MMM d, yyyy') : ''}
                    </Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>
                      {slot.showName || 'Unknown Show'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '25%' }]}>
                      {slot.episodeNumber ? `Ep #${slot.episodeNumber}` : 'TBD'}
                      {slot.episodeTitle ? `: ${slot.episodeTitle}` : ''}
                    </Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>
                      {slot.placementType || 'pre-roll'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '10%' }]}>
                      {slot.quantity || 1}
                    </Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>
                      ${((slot.price || 0) * (slot.quantity || 1)).toLocaleString()}
                    </Text>
                  </View>
                ))
              })}
            </View>
          ) : (
            <Text style={styles.value}>No slots scheduled</Text>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Schedule is subject to inventory availability and may require adjustments.
        </Text>
      </Page>
      
      {/* Generate Calendar Pages for Each Month */}
      {(() => {
        // Group slots by month
        const slotsByMonth = selectedSlots.reduce((acc, slot) => {
          const date = new Date(slot.airDate)
          const monthKey = format(date, 'yyyy-MM')
          if (!acc[monthKey]) {
            acc[monthKey] = []
          }
          acc[monthKey].push(slot)
          return acc
        }, {} as Record<string, SelectedSlot[]>)
        
        // Sort months
        const sortedMonths = Object.keys(slotsByMonth).sort()
        
        // Generate color map for shows
        const showColors = {} as Record<string, string>
        selectedShows.forEach((show, index) => {
          const colors = [
            '#1976d2', '#388e3c', '#d32f2f', '#f57c00', '#7b1fa2',
            '#0288d1', '#689f38', '#e64a19', '#00796b', '#c2185b',
            '#5d4037', '#455a64', '#fbc02d', '#303f9f', '#0097a7'
          ]
          showColors[show.id] = colors[index % colors.length]
        })
        
        // Generate calendar and summary pages for each month
        return sortedMonths.flatMap(monthKey => {
          const [year, month] = monthKey.split('-').map(Number)
          const monthDate = new Date(year, month - 1, 1)
          const monthSlots = slotsByMonth[monthKey]
          
          // Calculate month boundaries
          const firstDay = startOfMonth(monthDate)
          const lastDay = endOfMonth(monthDate)
          const startCalendar = startOfWeek(firstDay)
          const endCalendar = endOfWeek(lastDay)
          
          // Generate all days for the calendar grid
          const calendarDays = eachDayOfInterval({ start: startCalendar, end: endCalendar })
          
          // Group month slots by date
          const monthSlotsByDate = monthSlots.reduce((acc, slot) => {
            const dateKey = format(new Date(slot.airDate), 'yyyy-MM-dd')
            if (!acc[dateKey]) {
              acc[dateKey] = []
            }
            acc[dateKey].push(slot)
            return acc
          }, {} as Record<string, SelectedSlot[]>)
          
          // Calculate monthly total
          const monthlyTotal = monthSlots.reduce((sum, slot) => 
            sum + (slot.price || 0) * (slot.quantity || 1), 0
          )
          
          return [
            <Page key={monthKey} size="A4" style={styles.page}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Campaign Calendar - {format(monthDate, 'MMMM yyyy')}</Text>
                <Text style={styles.subtitle}>{campaignName || 'Untitled Campaign'}</Text>
                <Text style={styles.subtitle}>Monthly Investment: ${monthlyTotal.toLocaleString()}</Text>
              </View>
              
              {/* Show Legend */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Show Legend</Text>
                <View style={styles.legendContainer}>
                  {selectedShows.reduce((rows, show, index) => {
                    const showColor = showColors[show.id]
                    const showSlotsInMonth = monthSlots.filter(s => s.showId === show.id)
                    if (showSlotsInMonth.length === 0) return rows
                    
                    const rowIndex = Math.floor(rows.flat().length / 3)
                    
                    if (!rows[rowIndex]) {
                      rows[rowIndex] = []
                    }
                    
                    rows[rowIndex].push(
                      <View key={show.id} style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: showColor }]} />
                        <Text style={styles.legendText}>
                          {show.name} ({showSlotsInMonth.length} slots)
                        </Text>
                      </View>
                    )
                    
                    return rows
                  }, [] as any[]).map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.legendRow}>
                      {row}
                    </View>
                  ))}
                </View>
              </View>
              
              {/* Calendar Grid */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Monthly Calendar</Text>
                
                <View style={styles.calendarContainer}>
                  {/* Weekday Headers */}
                  <View style={styles.calendarWeekDays}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <View key={day} style={styles.calendarWeekDay}>
                        <Text style={styles.calendarWeekDayText}>{day}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Calendar Grid - Organized by weeks */}
                  <View style={styles.calendarGrid}>
                    {(() => {
                      // Group calendar days into weeks
                      const weeks = []
                      for (let i = 0; i < calendarDays.length; i += 7) {
                        weeks.push(calendarDays.slice(i, i + 7))
                      }
                      
                      return weeks.map((week, weekIndex) => (
                        <View key={weekIndex} style={styles.calendarWeek}>
                          {week.map((day, dayIndex) => {
                            const isCurrentMonth = isSameMonth(day, monthDate)
                            const dateKey = format(day, 'yyyy-MM-dd')
                            const daySlots = monthSlotsByDate[dateKey] || []
                            const dailyTotal = daySlots.reduce((sum, slot) => 
                              sum + (slot.price || 0) * (slot.quantity || 1), 0
                            )
                            
                            return (
                              <View 
                                key={dayIndex} 
                                style={[
                                  styles.calendarCell,
                                  !isCurrentMonth && styles.calendarCellInactive,
                                  dayIndex === 6 && { borderRight: 0 } // Remove right border for last column
                                ]}
                              >
                                {isCurrentMonth ? (
                                  <>
                                    <Text style={styles.calendarDate}>{format(day, 'd')}</Text>
                                    
                                    {/* Show spots for this day */}
                                    {daySlots.slice(0, 3).map((slot, slotIndex) => {
                                      const showColor = showColors[slot.showId] || '#666666'
                                      const placementAbbr = slot.placementType === 'pre-roll' ? 'Pre' : 
                                                           slot.placementType === 'mid-roll' ? 'Mid' : 
                                                           slot.placementType === 'post-roll' ? 'Post' : 'Ad'
                                      const showNameShort = slot.showName ? 
                                        (slot.showName.length > 10 ? slot.showName.substring(0, 10) + '...' : slot.showName) : 
                                        'Show'
                                      
                                      return (
                                        <View key={slotIndex} style={[styles.calendarSpot, { backgroundColor: showColor }]}>
                                          <Text style={styles.calendarSpotText}>
                                            {placementAbbr}: {showNameShort}
                                          </Text>
                                        </View>
                                      )
                                    })}
                                    
                                    {/* Show more indicator if needed */}
                                    {daySlots.length > 3 && (
                                      <View style={styles.moreIndicator}>
                                        <Text style={styles.moreIndicatorText}>
                                          +{daySlots.length - 3} more
                                        </Text>
                                      </View>
                                    )}
                                    
                                    {/* Daily total */}
                                    {dailyTotal > 0 && (
                                      <Text style={styles.calendarDailyTotal}>
                                        ${dailyTotal >= 1000 ? `${(dailyTotal/1000).toFixed(1)}k` : dailyTotal.toLocaleString()}
                                      </Text>
                                    )}
                                  </>
                                ) : (
                                  <Text style={{ fontSize: 10, color: '#ccc' }}>{format(day, 'd')}</Text>
                                )}
                              </View>
                            )
                          })}
                        </View>
                      ))
                    })()}
                  </View>
                </View>
              </View>
              
              {/* Footer */}
              <Text style={styles.footer}>
                {format(monthDate, 'MMMM yyyy')} Calendar
              </Text>
            </Page>,
            
            <Page key={`${monthKey}-summary`} size="A4" style={styles.page}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>{format(monthDate, 'MMMM yyyy')} - Summary</Text>
                <Text style={styles.subtitle}>{campaignName || 'Untitled Campaign'}</Text>
              </View>
              
              {/* Enhanced Monthly Summary */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Monthly Summary</Text>
                
                {/* Overall Monthly Metrics */}
                <View style={[styles.table, { marginBottom: 10 }]}>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, { width: '25%' }]}>Metric</Text>
                    <Text style={[styles.tableCell, { width: '25%' }]}>Value</Text>
                    <Text style={[styles.tableCell, { width: '25%' }]}>Metric</Text>
                    <Text style={[styles.tableCell, { width: '25%' }]}>Value</Text>
                  </View>
                  {(() => {
                    const totalSpotsMonth = monthSlots.reduce((sum, slot) => sum + (slot.quantity || 1), 0)
                    const totalImpressionsMonth = monthSlots.reduce((sum, slot) => 
                      sum + ((slot.estimatedImpressions || 0) * (slot.quantity || 1)), 0
                    )
                    const avgCPMMonth = totalImpressionsMonth > 0 ? 
                      (monthlyTotal / totalImpressionsMonth) * 1000 : 0
                    
                    return (
                      <>
                        <View style={styles.tableRow}>
                          <Text style={[styles.tableCell, { width: '25%' }]}>Total Spots</Text>
                          <Text style={[styles.tableCell, { width: '25%', fontWeight: 'bold' }]}>{totalSpotsMonth}</Text>
                          <Text style={[styles.tableCell, { width: '25%' }]}>Broadcast Days</Text>
                          <Text style={[styles.tableCell, { width: '25%', fontWeight: 'bold' }]}>{Object.keys(monthSlotsByDate).length}</Text>
                        </View>
                        <View style={styles.tableRow}>
                          <Text style={[styles.tableCell, { width: '25%' }]}>Total Revenue</Text>
                          <Text style={[styles.tableCell, { width: '25%', fontWeight: 'bold' }]}>${monthlyTotal.toLocaleString()}</Text>
                          <Text style={[styles.tableCell, { width: '25%' }]}>Avg CPM</Text>
                          <Text style={[styles.tableCell, { width: '25%', fontWeight: 'bold' }]}>${avgCPMMonth.toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                          <Text style={[styles.tableCell, { width: '25%' }]}>Est. Impressions</Text>
                          <Text style={[styles.tableCell, { width: '25%', fontWeight: 'bold' }]}>
                            {totalImpressionsMonth >= 1000 ? `${(totalImpressionsMonth/1000).toFixed(0)}K` : totalImpressionsMonth.toLocaleString()}
                          </Text>
                          <Text style={[styles.tableCell, { width: '25%' }]}>Shows Active</Text>
                          <Text style={[styles.tableCell, { width: '25%', fontWeight: 'bold' }]}>
                            {new Set(monthSlots.map(s => s.showId)).size}
                          </Text>
                        </View>
                      </>
                    )
                  })()}
                </View>
                
                {/* Show-Level Breakdown */}
                <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 10, marginBottom: 5 }]}>Show-Level Breakdown</Text>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, { width: '30%' }]}>Show</Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>Spots</Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>Revenue</Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>Impressions</Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>CPM</Text>
                  </View>
                  {selectedShows.map(show => {
                    const showSlotsMonth = monthSlots.filter(s => s.showId === show.id)
                    if (showSlotsMonth.length === 0) return null
                    
                    const showSpotsMonth = showSlotsMonth.reduce((sum, slot) => sum + (slot.quantity || 1), 0)
                    const showRevenueMonth = showSlotsMonth.reduce((sum, slot) => 
                      sum + ((slot.price || 0) * (slot.quantity || 1)), 0
                    )
                    const showImpressionsMonth = showSlotsMonth.reduce((sum, slot) => 
                      sum + ((slot.estimatedImpressions || 0) * (slot.quantity || 1)), 0
                    )
                    const showCPMMonth = showImpressionsMonth > 0 ? 
                      (showRevenueMonth / showImpressionsMonth) * 1000 : 0
                    
                    return (
                      <View key={show.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { width: '30%' }]}>{show.name}</Text>
                        <Text style={[styles.tableCell, { width: '15%' }]}>{showSpotsMonth}</Text>
                        <Text style={[styles.tableCell, { width: '20%' }]}>${showRevenueMonth.toLocaleString()}</Text>
                        <Text style={[styles.tableCell, { width: '20%' }]}>
                          {showImpressionsMonth >= 1000 ? `${(showImpressionsMonth/1000).toFixed(0)}K` : showImpressionsMonth.toLocaleString()}
                        </Text>
                        <Text style={[styles.tableCell, { width: '15%' }]}>${showCPMMonth.toFixed(2)}</Text>
                      </View>
                    )
                  }).filter(Boolean)}
                </View>
              </View>
              
              {/* Weekly Summary */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Weekly Breakdown</Text>
                {(() => {
                  // Group slots by week
                  const slotsByWeek = monthSlots.reduce((acc, slot) => {
                    const slotDate = new Date(slot.airDate)
                    const weekStart = startOfWeek(slotDate)
                    const weekEnd = endOfWeek(slotDate)
                    const weekKey = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
                    
                    if (!acc[weekKey]) {
                      acc[weekKey] = {
                        start: weekStart,
                        slots: []
                      }
                    }
                    acc[weekKey].slots.push(slot)
                    return acc
                  }, {} as Record<string, { start: Date, slots: SelectedSlot[] }>)
                  
                  // Sort weeks by start date
                  const sortedWeeks = Object.entries(slotsByWeek).sort(
                    (a, b) => a[1].start.getTime() - b[1].start.getTime()
                  )
                  
                  if (sortedWeeks.length === 0) {
                    return <Text style={styles.value}>No weekly data available</Text>
                  }
                  
                  return (
                    <View style={styles.table}>
                      <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={[styles.tableCell, { width: '30%' }]}>Week</Text>
                        <Text style={[styles.tableCell, { width: '15%' }]}>Spots</Text>
                        <Text style={[styles.tableCell, { width: '20%' }]}>Revenue</Text>
                        <Text style={[styles.tableCell, { width: '20%' }]}>Impressions</Text>
                        <Text style={[styles.tableCell, { width: '15%' }]}>CPM</Text>
                      </View>
                      {sortedWeeks.map(([weekLabel, weekData]) => {
                        const weekSlots = weekData.slots
                        const weekSpots = weekSlots.reduce((sum, slot) => sum + (slot.quantity || 1), 0)
                        const weekRevenue = weekSlots.reduce((sum, slot) => 
                          sum + ((slot.price || 0) * (slot.quantity || 1)), 0
                        )
                        const weekImpressions = weekSlots.reduce((sum, slot) => 
                          sum + ((slot.estimatedImpressions || 0) * (slot.quantity || 1)), 0
                        )
                        const weekCPM = weekImpressions > 0 ? 
                          (weekRevenue / weekImpressions) * 1000 : 0
                        
                        return (
                          <View key={weekLabel} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { width: '30%', fontSize: 8 }]}>{weekLabel}</Text>
                            <Text style={[styles.tableCell, { width: '15%' }]}>{weekSpots}</Text>
                            <Text style={[styles.tableCell, { width: '20%' }]}>${weekRevenue.toLocaleString()}</Text>
                            <Text style={[styles.tableCell, { width: '20%' }]}>
                              {weekImpressions >= 1000 ? `${(weekImpressions/1000).toFixed(0)}K` : weekImpressions.toLocaleString()}
                            </Text>
                            <Text style={[styles.tableCell, { width: '15%' }]}>${weekCPM.toFixed(2)}</Text>
                          </View>
                        )
                      })}
                    </View>
                  )
                })()}
              </View>
              
              {/* Footer */}
              <Text style={styles.footer}>
                {format(monthDate, 'MMMM yyyy')} Summary
              </Text>
            </Page>
          ]
        })
      })()}
    </Document>
  )
}