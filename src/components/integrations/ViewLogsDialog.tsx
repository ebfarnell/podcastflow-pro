'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  TablePagination,
} from '@mui/material'
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface SyncLog {
  id: string
  syncType: string
  status: string
  completedAt: string | null
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  quotaUsed: number
  syncConfig: any
  results: any
  createdAt: string
}

interface ViewLogsDialogProps {
  open: boolean
  onClose: () => void
  platform: string
  title?: string
}

export function ViewLogsDialog({ open, onClose, platform, title }: ViewLogsDialogProps) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)

  const isAdmin = user?.role === 'admin' || user?.role === 'master'

  useEffect(() => {
    if (open) {
      loadLogs()
    }
  }, [open, page, rowsPerPage])

  const loadLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await api.get(`/${platform}/sync-logs`, {
        params: {
          limit: rowsPerPage,
          offset: page * rowsPerPage
        }
      })
      
      setLogs(response.data.logs || [])
      setStats(response.data.stats)
      setTotalCount(response.data.pagination?.total || 0)
    } catch (error: any) {
      console.error('Error loading sync logs:', error)
      setError('Failed to load sync logs')
    } finally {
      setLoading(false)
    }
  }

  const handleClearOldLogs = async () => {
    try {
      await api.delete(`/${platform}/sync-logs`)
      await loadLogs()
    } catch (error: any) {
      console.error('Error clearing logs:', error)
      setError('Failed to clear old logs')
    }
  }

  const getStatusChip = (status: string) => {
    const color = status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning'
    const icon = status === 'completed' ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : 
                 status === 'failed' ? <ErrorIcon sx={{ fontSize: 16 }} /> : null
    
    return (
      <Chip
        label={status}
        color={color}
        size="small"
        icon={icon}
      />
    )
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString()
  }

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{title || `${platform} Sync Logs`}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadLogs} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {isAdmin && (
              <Tooltip title="Clear logs older than 30 days">
                <IconButton onClick={handleClearOldLogs} size="small" color="error">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Statistics Summary */}
        {stats && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">Total Syncs</Typography>
              <Typography variant="h6">{stats.total_syncs}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">Successful</Typography>
              <Typography variant="h6" color="success.main">{stats.successful_syncs}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">Failed</Typography>
              <Typography variant="h6" color="error.main">{stats.failed_syncs}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">Items Processed</Typography>
              <Typography variant="h6">{stats.total_items_processed?.toLocaleString() || 0}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">Quota Used</Typography>
              <Typography variant="h6">{stats.total_quota_used?.toLocaleString() || 0}</Typography>
            </Paper>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No sync logs found
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Processed</TableCell>
                    <TableCell align="right">Success</TableCell>
                    <TableCell align="right">Failed</TableCell>
                    <TableCell align="right">Quota</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(log.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>{log.syncType}</TableCell>
                      <TableCell>{getStatusChip(log.status)}</TableCell>
                      <TableCell align="right">{log.totalItems}</TableCell>
                      <TableCell align="right">{log.processedItems}</TableCell>
                      <TableCell align="right">
                        <Typography color="success.main">
                          {log.successfulItems}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {log.failedItems > 0 && (
                          <Typography color="error.main">
                            {log.failedItems}
                          </Typography>
                        )}
                        {log.failedItems === 0 && '-'}
                      </TableCell>
                      <TableCell align="right">{log.quotaUsed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}