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
  LinearProgress,
  Avatar,
  AvatarGroup,
} from '@mui/material'
import {
  Search,
  Description,
  CheckCircle,
  Schedule,
  Send,
  Gavel,
  Assignment,
  Edit,
  Visibility,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Contract {
  id: string
  contractNumber: string
  title: string
  contractType: string
  status: string
  totalAmount: number
  netAmount: number
  startDate: string
  endDate: string
  advertiser: {
    id: string
    name: string
  }
  signatures: Array<{
    id: string
    signerName: string
    signerType: string
    status: string
  }>
}

export default function ContractsSection() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Fetch contracts data
  const { data, isLoading, error } = useQuery({
    queryKey: ['post-sale-contracts', searchQuery, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter) params.append('status', statusFilter)
      if (typeFilter) params.append('contractType', typeFilter)

      const response = await fetch(`/api/contracts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch contracts')
      return response.json()
    },
  })

  const contracts = data?.contracts || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default'
      case 'pending_review': return 'warning'
      case 'approved': return 'info'
      case 'sent': return 'primary'
      case 'signed': return 'success'
      case 'executed': return 'success'
      case 'cancelled': return 'error'
      case 'expired': return 'error'
      default: return 'default'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'insertion_order': return <Assignment />
      case 'master_agreement': return <Gavel />
      case 'amendment': return <Edit />
      case 'renewal': return <Schedule />
      default: return <Description />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'insertion_order': return 'Insertion Order'
      case 'master_agreement': return 'Master Agreement'
      case 'amendment': return 'Amendment'
      case 'renewal': return 'Renewal'
      default: return type
    }
  }

  const getSignatureStatus = (signatures: Contract['signatures']) => {
    if (!signatures || signatures.length === 0) return 'No signatures required'
    
    const total = signatures.length
    const signed = signatures.filter(s => s.status === 'signed').length
    
    if (signed === total) return 'All signed'
    if (signed === 0) return 'Awaiting signatures'
    return `${signed}/${total} signed`
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="error">Failed to load contracts. Please try again.</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            placeholder="Search contracts..."
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
              <MenuItem value="pending_review">Pending Review</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="sent">Sent</MenuItem>
              <MenuItem value="signed">Signed</MenuItem>
              <MenuItem value="executed">Executed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="Type"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="insertion_order">Insertion Order</MenuItem>
              <MenuItem value="master_agreement">Master Agreement</MenuItem>
              <MenuItem value="amendment">Amendment</MenuItem>
              <MenuItem value="renewal">Renewal</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Contracts Table */}
      {isLoading ? (
        <LinearProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Contract</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Advertiser</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Signatures</TableCell>
                <TableCell>Period</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      No contracts found. Adjust your filters or create a new contract.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((contract: Contract) => (
                  <TableRow key={contract.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">{contract.contractNumber}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {contract.title}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getTypeIcon(contract.contractType)}
                        <Typography variant="body2">
                          {getTypeLabel(contract.contractType)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{contract.advertiser?.name || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={contract.status.replace('_', ' ')}
                        size="small"
                        color={getStatusColor(contract.status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        ${contract.netAmount?.toLocaleString() || '0'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {contract.signatures && contract.signatures.length > 0 ? (
                          <>
                            <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 12 } }}>
                              {contract.signatures.map((sig) => (
                                <Tooltip key={sig.id} title={`${sig.signerName} (${sig.status})`}>
                                  <Avatar sx={{ bgcolor: sig.status === 'signed' ? 'success.main' : 'grey.400' }}>
                                    {sig.signerName.charAt(0)}
                                  </Avatar>
                                </Tooltip>
                              ))}
                            </AvatarGroup>
                            <Typography variant="caption" color="textSecondary">
                              {getSignatureStatus(contract.signatures)}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            No signatures
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="textSecondary">
                        {format(new Date(contract.startDate), 'MMM d')} - {format(new Date(contract.endDate), 'MMM d, yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Contract">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/contracts/${contract.id}`)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}