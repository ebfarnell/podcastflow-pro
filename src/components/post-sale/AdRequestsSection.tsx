import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
} from '@mui/material'
import { Task, Schedule } from '@mui/icons-material'

export default function AdRequestsSection() {
  return (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Stack spacing={3} alignItems="center">
        <Task sx={{ fontSize: 64, color: 'text.secondary' }} />
        <Typography variant="h5" gutterBottom>
          Ad Requests Coming Soon
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 600 }}>
          This feature will be implemented in Phase 3. Ad requests will automatically be created 
          when orders are approved, assigning tasks to producers and talent based on show assignments.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Schedule />}
            disabled
          >
            View Schedule
          </Button>
          <Button
            variant="contained"
            startIcon={<Task />}
            disabled
          >
            Create Request
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}