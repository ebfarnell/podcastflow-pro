'use client'

import {
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  Button,
  Paper,
  Alert
} from '@mui/material'
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  Podcasts as PodcastIcon
} from '@mui/icons-material'
import { format } from 'date-fns'
import { SelectedSlot } from '@/hooks/useScheduleBuilder'

interface ScheduleCartProps {
  selectedSlots: SelectedSlot[]
  onRemoveSlot: (slotId: string) => void
  onClose: () => void
  totalPrice: number
  totalSlots: number
  campaignBudget?: number | null
}

export function ScheduleCart({
  selectedSlots,
  onRemoveSlot,
  onClose,
  totalPrice,
  totalSlots,
  campaignBudget
}: ScheduleCartProps) {
  // Group slots by show
  const slotsByShow = selectedSlots.reduce((acc, slot) => {
    if (!acc[slot.showName]) {
      acc[slot.showName] = []
    }
    acc[slot.showName].push(slot)
    return acc
  }, {} as Record<string, SelectedSlot[]>)

  const isOverBudget = campaignBudget && totalPrice > campaignBudget

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Schedule Cart ({totalSlots} slots)
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Budget Alert */}
      {isOverBudget && (
        <Alert severity="warning" sx={{ m: 2 }}>
          You are over budget by ${(totalPrice - campaignBudget).toLocaleString()}
        </Alert>
      )}

      {/* Slots List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {selectedSlots.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No slots selected yet
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Click on available slots in the calendar to add them
            </Typography>
          </Box>
        ) : (
          <List>
            {Object.entries(slotsByShow).map(([showName, slots]) => (
              <Box key={showName}>
                <ListItem sx={{ bgcolor: 'grey.100' }}>
                  <PodcastIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText 
                    primary={showName}
                    secondary={`${slots.length} slots`}
                  />
                </ListItem>
                {slots.map(slot => (
                  <ListItem key={slot.id} sx={{ pl: 4 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            Episode #{slot.episodeNumber}
                          </Typography>
                          <Chip 
                            label={slot.placementType} 
                            size="small" 
                            color={
                              slot.placementType === 'pre-roll' ? 'primary' :
                              slot.placementType === 'mid-roll' ? 'secondary' : 'success'
                            }
                          />
                          {slot.quantity > 1 && (
                            <Chip 
                              label={`x${slot.quantity}`} 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <CalendarIcon fontSize="small" />
                            <Typography variant="caption">
                              {format(new Date(slot.airDate), 'MMM d, yyyy')}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <MoneyIcon fontSize="small" />
                            <Typography variant="caption">
                              ${slot.price} × {slot.quantity} = ${slot.price * slot.quantity}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => onRemoveSlot(slot.id)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
                <Divider />
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Footer */}
      <Paper elevation={3} sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2">Subtotal</Typography>
          <Typography variant="subtitle2">${totalPrice.toLocaleString()}</Typography>
        </Box>
        {campaignBudget && (
          <>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Budget
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                ${campaignBudget.toLocaleString()}
              </Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle2" color={isOverBudget ? 'error.main' : 'success.main'}>
                Remaining
              </Typography>
              <Typography variant="subtitle2" color={isOverBudget ? 'error.main' : 'success.main'}>
                ${(campaignBudget - totalPrice).toLocaleString()}
              </Typography>
            </Box>
          </>
        )}
        <Divider sx={{ my: 2 }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Total</Typography>
          <Typography variant="h6" color="primary">
            ${totalPrice.toLocaleString()}
          </Typography>
        </Box>
        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          onClick={onClose}
          disabled={selectedSlots.length === 0}
        >
          Continue to Review
        </Button>
      </Paper>
    </Box>
  )
}