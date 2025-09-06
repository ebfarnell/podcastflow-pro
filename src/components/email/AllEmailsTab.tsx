'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  Stack,
  Paper
} from '@mui/material'
import {
  Search as SearchIcon,
  Email as EmailIcon,
  OpenInNew as OpenIcon,
  TouchApp as ClickIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { EmailDetailModal } from './EmailDetailModal'

interface EmailRecord {
  id: string
  toEmail: string
  fromEmail: string
  subject: string
  status: string
  sentAt: string | null
  openedAt: string | null
  clickedAt: string | null
  seller?: {
    id: string
    name: string
    email: string
  } | null
  advertiser?: {
    id: string
    name: string
  } | null
  agency?: {
    id: string
    name: string
  } | null
  campaign?: {
    id: string
    name: string
  } | null
  hasOpened: boolean
  hasClicked: boolean
}

interface AllEmailsResponse {
  emails: EmailRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

type SortField = 'date' | 'seller' | 'advertiser' | 'agency' | 'subject' | 'status'
type SortOrder = 'asc' | 'desc'

const getStatusColor = (status: string): 'default' | 'success' | 'error' | 'warning' | 'info' => {
  switch (status) {
    case 'sent':
      return 'info'
    case 'delivered':
      return 'success'
    case 'bounced':
      return 'error'
    case 'complained':
      return 'warning'
    default:
      return 'default'
  }
}

export function AllEmailsTab() {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(searchTerm, 500)

  // Fetch emails data
  const { data, isLoading, error, refetch } = useQuery<AllEmailsResponse>({
    queryKey: ['all-emails', page + 1, rowsPerPage, debouncedSearch, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        search: debouncedSearch,
        sortBy,
        sortOrder
      })

      const response = await fetch(`/api/email/all-emails?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch emails')
      }
      return response.json()
    },
    keepPreviousData: true
  })

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleSort = (field: SortField) => {
    const isAsc = sortBy === field && sortOrder === 'asc'
    setSortOrder(isAsc ? 'desc' : 'asc')
    setSortBy(field)
    setPage(0)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        sortBy,
        sortOrder,
        format: 'csv'
      })

      const response = await fetch(`/api/email/all-emails/export?${params}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `emails-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
    } catch {
      return '-'
    }
  }

  const emails = data?.emails || []
  const pagination = data?.pagination

  return (
    <Box>
      <Card>
        <CardContent>
          {/* Header */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">All Emails</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                variant="outlined"
                size="small"
              >
                Refresh
              </Button>
              <Button
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                variant="outlined"
                size="small"
                disabled={!emails.length}
              >
                Export
              </Button>
            </Stack>
          </Box>

          {/* Search Bar */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search by subject or recipient email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(0)
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              size="small"
            />
          </Box>

          {/* Table */}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load emails. Please try again.
            </Alert>
          ) : emails.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <EmailIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No emails found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'Try adjusting your search criteria' : 'No emails have been sent yet'}
              </Typography>
            </Paper>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Recipient</TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'subject'}
                          direction={sortBy === 'subject' ? sortOrder : 'asc'}
                          onClick={() => handleSort('subject')}
                        >
                          Subject
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'seller'}
                          direction={sortBy === 'seller' ? sortOrder : 'asc'}
                          onClick={() => handleSort('seller')}
                        >
                          Seller
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'advertiser'}
                          direction={sortBy === 'advertiser' ? sortOrder : 'asc'}
                          onClick={() => handleSort('advertiser')}
                        >
                          Advertiser
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'agency'}
                          direction={sortBy === 'agency' ? sortOrder : 'asc'}
                          onClick={() => handleSort('agency')}
                        >
                          Agency
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'status'}
                          direction={sortBy === 'status' ? sortOrder : 'asc'}
                          onClick={() => handleSort('status')}
                        >
                          Status
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'date'}
                          direction={sortBy === 'date' ? sortOrder : 'asc'}
                          onClick={() => handleSort('date')}
                        >
                          Date Sent
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="center">Engagement</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow 
                        key={email.id} 
                        hover
                        onClick={() => setSelectedEmailId(email.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {email.toEmail}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                            {email.subject}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {email.seller ? (
                            <Box>
                              <Typography variant="body2">{email.seller.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {email.seller.email}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {email.advertiser ? (
                            <Typography variant="body2">{email.advertiser.name}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {email.agency ? (
                            <Typography variant="body2">{email.agency.name}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={email.status}
                            size="small"
                            color={getStatusColor(email.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(email.sentAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            {email.hasOpened && (
                              <Tooltip title={`Opened: ${formatDate(email.openedAt)}`}>
                                <OpenIcon fontSize="small" color="success" />
                              </Tooltip>
                            )}
                            {email.hasClicked && (
                              <Tooltip title={`Clicked: ${formatDate(email.clickedAt)}`}>
                                <ClickIcon fontSize="small" color="primary" />
                              </Tooltip>
                            )}
                            {!email.hasOpened && !email.hasClicked && (
                              <Typography variant="caption" color="text.secondary">
                                No activity
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {pagination && (
                <TablePagination
                  component="div"
                  count={pagination.total}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Modal */}
      {selectedEmailId && (
        <EmailDetailModal
          emailId={selectedEmailId}
          open={true}
          onClose={() => setSelectedEmailId(null)}
        />
      )}
    </Box>
  )
}