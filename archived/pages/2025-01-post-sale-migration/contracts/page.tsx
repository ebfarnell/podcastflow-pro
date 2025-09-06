'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { MigrationNotice } from '@/components/common/MigrationNotice'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  Avatar,
  Pagination,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import {
  Description,
  Add,
  Search,
  FilterList,
  Send,
  Visibility,
  Edit,
  Delete,
  GetApp,
  Assignment,
  Business,
  AttachMoney,
  CheckCircle,
  Schedule,
  MoreVert,
  FileDownload,
  Email,
  Gavel
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { PermissionGuard } from '@/components/ui/PermissionGuard'

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
  createdAt: string
  advertiser: {
    id: string
    name: string
    industry?: string
  }
  agency?: {
    id: string
    name: string
  }
  campaign?: {
    id: string
    name: string
  }
  order?: {
    id: string
    orderNumber: string
  }
  createdBy: {
    id: string
    name: string
    email: string
  }
  lineItems: Array<{
    id: string
    description: string
    totalPrice: number
  }>
  signatures: Array<{
    id: string
    signerName: string
    signerType: string
    status: string
  }>
}

export default function ContractsPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Data state
  const [contracts, setContracts] = useState<Contract[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [advertiserFilter, setAdvertiserFilter] = useState('')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  // Menu state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null)

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user) {
      fetchContracts()
    }
  }, [user, pagination.page, search, statusFilter, typeFilter, advertiserFilter])

  const fetchContracts = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      if (typeFilter) params.append('contractType', typeFilter)
      if (advertiserFilter) params.append('advertiserId', advertiserFilter)

      const response = await fetch(`/api/contracts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch contracts')
      
      const data = await response.json()
      setContracts(data.contracts)
      setPagination(data.pagination)
      setSummary(data.summary)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching contracts:', err)
      setError('Failed to load contracts')
      setLoading(false)
    }
  }

  const handleDeleteContract = async () => {
    if (!selectedContract) return

    try {
      const response = await fetch(`/api/contracts/${selectedContract.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete contract')

      setSuccess('Contract deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedContract(null)
      fetchContracts()
    } catch (err: any) {
      setError(err.message)
    }
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const { hasPermission } = useAuth()
  
  const canEditContract = (contract: Contract) => {
    return ['draft', 'pending_review'].includes(contract.status) && 
           hasPermission(PERMISSIONS.CONTRACTS_UPDATE)
  }

  const canDeleteContract = (contract: Contract) => {
    return ['draft'].includes(contract.status) && 
           hasPermission(PERMISSIONS.CONTRACTS_DELETE)
  }

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user) return null

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CONTRACTS_VIEW}>
      <DashboardLayout>
        <MigrationNotice targetTab="contracts" pageName="Contracts & IOs" />
        <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Contracts & IOs
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Manage insertion orders, contracts, and agreements
            </Typography>
          </Box>
          <PermissionGuard permission={PERMISSIONS.CONTRACTS_CREATE}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Contract
            </Button>
          </PermissionGuard>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Summary Cards */}
        {summary && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <Description />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">
                        {summary.totalContracts}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Total Contracts
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <AttachMoney />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">
                        {formatCurrency(summary.totalValue)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Total Value
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'warning.main' }}>
                      <Schedule />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">
                        {summary.statusBreakdown?.pending_review || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Pending Review
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'info.main' }}>
                      <CheckCircle />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">
                        {summary.statusBreakdown?.executed || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Executed
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search contracts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="pending_review">Pending Review</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="sent">Sent</MenuItem>
                  <MenuItem value="signed">Signed</MenuItem>
                  <MenuItem value="executed">Executed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  label="Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="insertion_order">Insertion Order</MenuItem>
                  <MenuItem value="master_agreement">Master Agreement</MenuItem>
                  <MenuItem value="amendment">Amendment</MenuItem>
                  <MenuItem value="renewal">Renewal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                  setTypeFilter('')
                  setAdvertiserFilter('')
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Contracts Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Contract</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Advertiser</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell>Signatures</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {contract.contractNumber}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {contract.title}
                        </Typography>
                        {contract.campaign && (
                          <Typography variant="caption" display="block" color="textSecondary">
                            Campaign: {contract.campaign.name}
                          </Typography>
                        )}
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
                      <Box>
                        <Typography variant="body2">
                          {contract.advertiser.name}
                        </Typography>
                        {contract.agency && (
                          <Typography variant="caption" color="textSecondary">
                            via {contract.agency.name}
                          </Typography>
                        )}
                        {contract.advertiser.industry && (
                          <Typography variant="caption" display="block" color="textSecondary">
                            {contract.advertiser.industry}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={contract.status.replace('_', ' ')}
                        color={getStatusColor(contract.status)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(contract.netAmount)}
                        </Typography>
                        {contract.totalAmount !== contract.netAmount && (
                          <Typography variant="caption" color="textSecondary">
                            Total: {formatCurrency(contract.totalAmount)}
                          </Typography>
                        )}
                        <Typography variant="caption" display="block" color="textSecondary">
                          {contract.lineItems.length} line item{contract.lineItems.length !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" display="block" color="textSecondary">
                          Created: {new Date(contract.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {contract.signatures.map((sig) => (
                          <Tooltip key={sig.id} title={`${sig.signerName} (${sig.status})`}>
                            <Chip
                              size="small"
                              label={sig.signerType}
                              color={sig.status === 'signed' ? 'success' : 'default'}
                              variant={sig.status === 'signed' ? 'filled' : 'outlined'}
                            />
                          </Tooltip>
                        ))}
                        {contract.signatures.length === 0 && (
                          <Typography variant="caption" color="textSecondary">
                            No signatures
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="View Contract">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/contracts/${contract.id}`)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <PermissionGuard permission={PERMISSIONS.CONTRACTS_UPDATE}>
                          {canEditContract(contract) && (
                            <Tooltip title="Edit Contract">
                              <IconButton
                                size="small"
                                onClick={() => router.push(`/contracts/${contract.id}/edit`)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                          )}
                        </PermissionGuard>
                        <Tooltip title="More Actions">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setActionMenuAnchor(e.currentTarget)
                              setSelectedContract(contract)
                            }}
                          >
                            <MoreVert />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {contracts.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Description sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Contracts Found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                {search || statusFilter || typeFilter ? 
                  'No contracts match your current filters.' :
                  'Start by creating your first contract or insertion order.'
                }
              </Typography>
              {!search && !statusFilter && !typeFilter && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Create First Contract
                </Button>
              )}
            </Box>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <Pagination
                count={pagination.pages}
                page={pagination.page}
                onChange={(_, page) => setPagination(prev => ({ ...prev, page }))}
                color="primary"
              />
            </Box>
          )}
        </Paper>

        {/* Actions Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={() => setActionMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            if (selectedContract) router.push(`/contracts/${selectedContract.id}`)
            setActionMenuAnchor(null)
          }}>
            <ListItemIcon><Visibility /></ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          
          {selectedContract && canEditContract(selectedContract) && (
            <MenuItem onClick={() => {
              if (selectedContract) router.push(`/contracts/${selectedContract.id}/edit`)
              setActionMenuAnchor(null)
            }}>
              <ListItemIcon><Edit /></ListItemIcon>
              <ListItemText>Edit Contract</ListItemText>
            </MenuItem>
          )}

          <MenuItem onClick={() => setActionMenuAnchor(null)}>
            <ListItemIcon><FileDownload /></ListItemIcon>
            <ListItemText>Download PDF</ListItemText>
          </MenuItem>

          <MenuItem onClick={() => setActionMenuAnchor(null)}>
            <ListItemIcon><Email /></ListItemIcon>
            <ListItemText>Send Email</ListItemText>
          </MenuItem>

          {selectedContract && canDeleteContract(selectedContract) && (
            <MenuItem 
              onClick={() => {
                setDeleteDialogOpen(true)
                setActionMenuAnchor(null)
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon><Delete sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText>Delete Contract</ListItemText>
            </MenuItem>
          )}
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Contract</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete contract {selectedContract?.contractNumber}? 
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteContract}>
              Delete Contract
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Contract Dialog - Placeholder */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Contract</DialogTitle>
          <DialogContent>
            <Typography>
              Contract creation form will be implemented here. This will include:
            </Typography>
            <ul>
              <li>Contract type selection</li>
              <li>Advertiser and agency selection</li>
              <li>Campaign and order linking</li>
              <li>Line items configuration</li>
              <li>Terms and conditions</li>
              <li>Template selection</li>
            </ul>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={() => setCreateDialogOpen(false)}>
              Create Contract
            </Button>
          </DialogActions>
        </Dialog>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}