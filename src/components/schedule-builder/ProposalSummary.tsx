'use client'

import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  Menu,
  MenuItem
} from '@mui/material'
import {
  FileDownload as DownloadIcon,
  Save as SaveIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material'
import { format } from 'date-fns'
import { Show, SelectedSlot } from '@/hooks/useScheduleBuilder'
import { toast } from '@/lib/toast'
import { pdf } from '@react-pdf/renderer'
import { saveAs } from 'file-saver'
import { ProposalPDF } from './ProposalPDF'
import React from 'react'
import { EmailProposalModal } from './EmailProposalModal'

interface ProposalSummaryProps {
  campaignName: string
  campaignBudget?: number | null
  campaignId?: string | null
  advertiserId?: string | null
  scheduleId?: string | null
  selectedShows: Show[]
  selectedSlots: SelectedSlot[]
  totalPrice: number
  onSave: () => void
  onExport: () => void
}

export function ProposalSummary({
  campaignName,
  campaignBudget,
  campaignId,
  advertiserId,
  scheduleId,
  selectedShows,
  selectedSlots,
  totalPrice,
  onSave,
  onExport
}: ProposalSummaryProps) {
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [proposalId, setProposalId] = useState<string | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null)

  // Calculate metrics
  const totalSlots = selectedSlots.reduce((sum, slot) => sum + slot.quantity, 0)
  const avgPricePerSlot = totalSlots > 0 ? totalPrice / totalSlots : 0
  const totalImpressions = selectedSlots.reduce(
    (sum, slot) => sum + (slot.estimatedImpressions || 0) * slot.quantity,
    0
  )
  const cpm = totalImpressions > 0 ? (totalPrice / totalImpressions) * 1000 : 0

  // Group by placement type for pie chart
  const placementData = ['pre-roll', 'mid-roll', 'post-roll'].map(type => {
    const slots = selectedSlots.filter(s => s.placementType === type)
    const count = slots.reduce((sum, slot) => sum + slot.quantity, 0)
    const value = slots.reduce((sum, slot) => sum + (slot.price * slot.quantity), 0)
    return { name: type, value, count }
  }).filter(d => d.value > 0)

  const COLORS = {
    'pre-roll': '#1976d2',
    'mid-roll': '#9c27b0',
    'post-roll': '#2e7d32'
  }

  // Group slots by date for schedule view
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

  const handleSaveProposal = async () => {
    setSaving(true)
    try {
      // Validate that we have required campaign context
      if (!campaignId) {
        toast.error('A campaign is required to save a schedule. Please select a campaign first.')
        setSaving(false)
        return
      }
      
      if (!advertiserId || advertiserId === 'undefined' || advertiserId === 'null') {
        toast.error('Campaign is missing advertiser information. Please ensure the campaign has an advertiser assigned.')
        setSaving(false)
        return
      }

      // Create schedule data in the format expected by the schedules API
      const scheduleData = {
        name: campaignName || 'Untitled Schedule',
        campaignId: campaignId, // Always linked to campaign
        advertiserId: advertiserId, // Use campaign's advertiser
        totalBudget: campaignBudget || 0,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        items: selectedSlots.map(slot => ({
          showId: slot.showId,
          episodeId: slot.episodeId,
          airDate: slot.airDate,
          placementType: slot.placementType,
          quantity: slot.quantity,
          negotiatedPrice: slot.price,
          price: slot.price,
          rateCardPrice: slot.rateCardPrice || slot.price
        }))
      }

      // If we have an existing schedule, update it. Otherwise create new.
      const response = await fetch(
        scheduleId ? `/api/schedules/${scheduleId}` : '/api/schedules',
        {
          method: scheduleId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData)
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Schedule save error response:', errorText)
        
        // Check if it's a conflict error with existing schedule
        try {
          const errorJson = JSON.parse(errorText)
          if (response.status === 409 && errorJson.existingScheduleId) {
            // We have an existing schedule, update it instead
            const updateResponse = await fetch(
              `/api/schedules/${errorJson.existingScheduleId}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleData)
              }
            )
            
            if (!updateResponse.ok) {
              throw new Error('Failed to update existing schedule')
            }
            
            const updateData = await updateResponse.json()
            toast.success('Schedule updated successfully!')
            
            // Redirect to campaign page
            setTimeout(() => {
              if (campaignId) {
                window.location.href = `/campaigns/${campaignId}?tab=4`
              } else {
                window.location.href = '/campaigns'
              }
            }, 1000)
            return
          }
        } catch (parseError) {
          // Not a JSON error or not a conflict, throw the original error
        }
        
        throw new Error('Failed to save schedule')
      }

      const data = await response.json()
      
      toast.success(scheduleId ? 'Schedule updated successfully!' : 'Schedule saved successfully!')
      
      // Always redirect to the campaign page after save
      // Small delay to let the toast show
      setTimeout(() => {
        if (campaignId) {
          window.location.href = `/campaigns/${campaignId}?tab=4`
        } else {
          window.location.href = '/campaigns'
        }
      }, 1000)
    } catch (error) {
      console.error('Save schedule error:', error)
      toast.error('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      // Generate PDF client-side
      const pdfDoc = (
        <ProposalPDF
          campaignName={campaignName}
          campaignBudget={campaignBudget}
          selectedShows={selectedShows}
          selectedSlots={selectedSlots}
          totalPrice={totalPrice}
          generatedDate={new Date()}
        />
      )

      const pdfBlob = await pdf(pdfDoc).toBlob()
      const fileName = `proposal-${campaignName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      saveAs(pdfBlob, fileName)
      
      toast.success('PDF exported successfully!')
      onExport()
    } catch (error) {
      console.error('Export PDF error:', error)
      toast.error('Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Box>
      {/* Campaign Overview */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Campaign Proposal Summary
        </Typography>
        <Typography variant="h6" color="primary" gutterBottom>
          {campaignName || 'Untitled Campaign'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
        </Typography>
      </Paper>

      {/* Key Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <MoneyIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Investment
                </Typography>
              </Box>
              <Typography variant="h4">
                ${totalPrice.toLocaleString()}
              </Typography>
              {campaignBudget && (
                <Typography variant="body2" color={totalPrice > campaignBudget ? 'error.main' : 'success.main'}>
                  Budget: ${campaignBudget.toLocaleString()}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CalendarIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Ad Slots
                </Typography>
              </Box>
              <Typography variant="h4">
                {totalSlots}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg ${avgPricePerSlot.toFixed(0)}/slot
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AssessmentIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Est. Impressions
                </Typography>
              </Box>
              <Typography variant="h4">
                {(totalImpressions / 1000).toFixed(0)}K
              </Typography>
              <Typography variant="body2" color="text.secondary">
                CPM: ${cpm.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TimelineIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Shows Selected
                </Typography>
              </Box>
              <Typography variant="h4">
                {selectedShows.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {sortedDates.length} broadcast days
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Placement Distribution */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Placement Distribution
            </Typography>
            <Box mt={3}>
              {placementData.map((item) => {
                const percentage = totalPrice > 0 ? (item.value / totalPrice) * 100 : 0
                return (
                  <Box key={item.name} mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            bgcolor: COLORS[item.name as keyof typeof COLORS],
                            borderRadius: 1
                          }}
                        />
                        <Typography variant="body2">
                          {item.name} ({item.count})
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="bold">
                        {percentage.toFixed(0)}%
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box
                        sx={{
                          flex: 1,
                          height: 8,
                          bgcolor: 'grey.200',
                          borderRadius: 1,
                          mr: 2,
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            width: `${percentage}%`,
                            height: '100%',
                            bgcolor: COLORS[item.name as keyof typeof COLORS],
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: 'right' }}>
                        ${item.value.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
              {placementData.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center">
                  No placements selected
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Show Distribution */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Show Distribution
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Show</TableCell>
                    <TableCell align="center">Episodes</TableCell>
                    <TableCell align="center">Slots</TableCell>
                    <TableCell align="right">Investment</TableCell>
                    <TableCell align="right">% of Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedShows.map(show => {
                    const showSlots = selectedSlots.filter(s => s.showId === show.id)
                    const showEpisodes = new Set(showSlots.map(s => s.episodeId)).size
                    const showTotal = showSlots.reduce((sum, slot) => sum + (slot.price * slot.quantity), 0)
                    const showSlotCount = showSlots.reduce((sum, slot) => sum + slot.quantity, 0)
                    const percentage = totalPrice > 0 ? (showTotal / totalPrice) * 100 : 0
                    
                    return (
                      <TableRow key={show.id}>
                        <TableCell>{show.name}</TableCell>
                        <TableCell align="center">{showEpisodes}</TableCell>
                        <TableCell align="center">{showSlotCount}</TableCell>
                        <TableCell align="right">${showTotal.toLocaleString()}</TableCell>
                        <TableCell align="right">{percentage.toFixed(1)}%</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Detailed Schedule */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Detailed Schedule
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Show</TableCell>
                    <TableCell>Episode</TableCell>
                    <TableCell>Placement</TableCell>
                    <TableCell align="center">Quantity</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedDates.map(date => (
                    slotsByDate[date].map((slot, index) => (
                      <TableRow key={`${date}-${slot.id}`}>
                        {index === 0 && (
                          <TableCell rowSpan={slotsByDate[date].length}>
                            {format(new Date(date), 'MMM d, yyyy')}
                          </TableCell>
                        )}
                        <TableCell>{slot.showName}</TableCell>
                        <TableCell>
                          Episode #{slot.episodeNumber || 'TBD'}
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {slot.episodeTitle || 'Title TBD'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={slot.placementType} 
                            size="small"
                            color={
                              slot.placementType === 'pre-roll' ? 'primary' :
                              slot.placementType === 'mid-roll' ? 'secondary' : 'success'
                            }
                          />
                        </TableCell>
                        <TableCell align="center">{slot.quantity}</TableCell>
                        <TableCell align="right">${slot.price}</TableCell>
                        <TableCell align="right">${slot.price * slot.quantity}</TableCell>
                      </TableRow>
                    ))
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Paper sx={{ p: 3, mt: 3, position: 'sticky', bottom: 0, zIndex: 100 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            {campaignBudget && totalPrice > campaignBudget && (
              <Alert severity="warning">
                This proposal exceeds the campaign budget by ${(totalPrice - campaignBudget).toLocaleString()}
              </Alert>
            )}
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSaveProposal}
                disabled={saving || exporting}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {saving ? 'Saving...' : 'Save and Close'}
              </Button>
              <Button
                variant="contained"
                endIcon={<ArrowDropDownIcon />}
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                disabled={saving || exporting}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Export
              </Button>
              <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem 
                  onClick={() => {
                    setExportMenuAnchor(null)
                    setEmailModalOpen(true)
                  }}
                  disabled={!proposalId}
                >
                  <EmailIcon sx={{ mr: 1 }} fontSize="small" />
                  Email Proposal
                </MenuItem>
                <MenuItem 
                  onClick={() => {
                    setExportMenuAnchor(null)
                    window.print()
                  }}
                >
                  <PrintIcon sx={{ mr: 1 }} fontSize="small" />
                  Print
                </MenuItem>
                <MenuItem 
                  onClick={() => {
                    setExportMenuAnchor(null)
                    handleExportPDF()
                  }}
                >
                  <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
                  Export as PDF
                </MenuItem>
              </Menu>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Email Modal */}
      {proposalId && (
        <EmailProposalModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          proposalId={proposalId}
          campaignName={campaignName || 'Untitled Campaign'}
        />
      )}
    </Box>
  )
}