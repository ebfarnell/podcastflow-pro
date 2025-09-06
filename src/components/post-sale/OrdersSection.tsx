import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  Button,
  Menu,
  ListItemIcon,
  ListItemText,
  Pagination,
  LinearProgress,
} from '@mui/material'
import {
  Search,
  FilterList,
  Visibility,
  Edit,
  MoreVert,
  CheckCircle,
  Schedule,
  Cancel,
  AttachMoney,
  Assignment,
  Timeline,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Order {
  id: string
  orderNumber: string
  campaign: {
    id: string
    name: string
  }
  advertiser: {
    id: string
    name: string
  }
  agency?: {
    id: string
    name: string
  }
  status: string
  totalAmount: number
  netAmount: number
  createdAt: string
  itemCount: number
}

export default function OrdersSection() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  // View mode removed - only list view available
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Fetch orders data
  const { data, isLoading, error } = useQuery({
    queryKey: ['post-sale-orders', page, searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      return response.json()
    },
  })

  const orders = data?.orders || []
  const pagination = data?.pagination || { total: 0, pages: 0, page: 1 }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default'
      case 'pending_approval': return 'warning'
      case 'approved': return 'info'
      case 'booked': return 'primary'
      case 'confirmed': return 'success'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit fontSize="small" />
      case 'pending_approval': return <Schedule fontSize="small" />
      case 'approved': return <CheckCircle fontSize="small" />
      case 'booked': return <Assignment fontSize="small" />
      case 'confirmed': return <CheckCircle fontSize="small" />
      case 'cancelled': return <Cancel fontSize="small" />
      default: return null
    }
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, order: Order) => {
    setMenuAnchor(event.currentTarget)
    setSelectedOrder(order)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
    setSelectedOrder(null)
  }

  const handleViewOrder = () => {
    if (selectedOrder) {
      router.push(`/insertion-orders/${selectedOrder.id}`)
    }
    handleMenuClose()
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="error">Failed to load orders. Please try again.</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1, width: { xs: '100%', md: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="pending_approval">Pending Approval</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="booked">Booked</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          {/* View toggle buttons removed - only list view available */}
        </Stack>
      </Paper>

      {/* Orders Table */}
      {isLoading ? (
        <LinearProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Campaign</TableCell>
                <TableCell>Advertiser</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Net Amount</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      No orders found. Adjust your filters or create a new order.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order: Order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{order.orderNumber}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.campaign?.name || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{order.advertiser?.name || 'N/A'}</Typography>
                        {order.agency && (
                          <Typography variant="caption" color="textSecondary">
                            via {order.agency.name}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(order.status)}
                        label={order.status.replace('_', ' ')}
                        size="small"
                        color={getStatusColor(order.status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        ${order.netAmount?.toLocaleString() || '0'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(order.createdAt), 'MMM d, yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, order)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.pages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewOrder}>
          <ListItemIcon><Visibility /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedOrder) router.push(`/insertion-orders/${selectedOrder.id}/edit`)
          handleMenuClose()
        }}>
          <ListItemIcon><Edit /></ListItemIcon>
          <ListItemText>Edit Order</ListItemText>
        </MenuItem>
        {/* Timeline feature not yet implemented
        <MenuItem onClick={() => {
          if (selectedOrder) router.push(`/insertion-orders/${selectedOrder.id}/timeline`)
          handleMenuClose()
        }}>
          <ListItemIcon><Timeline /></ListItemIcon>
          <ListItemText>View Timeline</ListItemText>
        </MenuItem>
        */}
      </Menu>
    </Box>
  )
}