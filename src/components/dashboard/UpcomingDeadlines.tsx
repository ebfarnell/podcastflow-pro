import { List, ListItem, ListItemText, Typography, Box, Chip, Card, CardContent, Skeleton, Button } from '@mui/material'
import { CalendarToday } from '@mui/icons-material'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useRouter } from 'next/navigation'

dayjs.extend(relativeTime)

interface Deadline {
  id: string
  title: string
  description?: string
  dueDate: string
  daysUntilDue: number
  priority: string
  type: string
  campaignId?: string
  campaignName?: string
  assignedTo?: string
  status: string
}

interface UpcomingDeadlinesProps {
  deadlines?: Deadline[]
  loading?: boolean
}

export function UpcomingDeadlines({ deadlines = [], loading = false }: UpcomingDeadlinesProps) {
  const router = useRouter()
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'default'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upcoming Deadlines
          </Typography>
          <Box>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="text" height={60} sx={{ mb: 1 }} />
            ))}
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (deadlines.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upcoming Deadlines
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No upcoming deadlines. All tasks are on track!
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Upcoming Deadlines
        </Typography>
        <List sx={{ width: '100%' }}>
          {deadlines.map((deadline) => (
        <ListItem
          key={deadline.id}
          sx={{
            px: 0,
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '&:last-child': {
              borderBottom: 0,
            },
          }}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">{deadline.title}</Typography>
                <Chip
                  label={deadline.priority}
                  size="small"
                  color={getPriorityColor(deadline.priority)}
                />
              </Box>
            }
            secondary={
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {deadline.campaignName || deadline.type}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(deadline.dueDate).fromNow()} • {dayjs(deadline.dueDate).format('MMM D, YYYY')}
                  </Typography>
                </Box>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
      </CardContent>
    </Card>
  )
}