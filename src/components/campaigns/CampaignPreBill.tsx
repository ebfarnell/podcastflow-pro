'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import {
  Receipt as ReceiptIcon,
  Add as AddIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'

interface PreBill {
  id: string
  campaignId: string
  type: 'campaign' | 'monthly'
  month?: string
  amount: number
  status: 'draft' | 'sent' | 'paid'
  createdAt: string
  sentAt?: string
  paidAt?: string
  createdBy: string
  notes?: string
}

interface CampaignPreBillProps {
  campaignId: string
  campaign: any
}

export function CampaignPreBill({ campaignId, campaign }: CampaignPreBillProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [preBills, setPreBills] = useState<PreBill[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [preBillType, setPreBillType] = useState<'campaign' | 'monthly'>('campaign')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [preBillAmount, setPreBillAmount] = useState('')
  const [preBillNotes, setPreBillNotes] = useState('')

  // Check if user has permission to generate pre-bills
  const canGeneratePreBill = user?.role && ['sales', 'admin', 'master'].includes(user.role)
  
  // Check if campaign is eligible for pre-billing (90% probability and approved)
  const isEligibleForPreBill = campaign?.probability >= 90 && campaign?.approvalStatus === 'approved'

  useEffect(() => {
    fetchPreBills()
  }, [campaignId])

  const fetchPreBills = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pre-bills`)
      
      if (response.ok) {
        const data = await response.json()
        setPreBills(data.preBills || [])
      } else if (response.status === 404) {
        // No pre-bills found is fine
        setPreBills([])
      } else {
        console.error('Failed to fetch pre-bills')
      }
    } catch (error) {
      console.error('Error fetching pre-bills:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePreBill = async () => {
    if (!canGeneratePreBill) {
      toast.error('You do not have permission to generate pre-bills')
      return
    }

    if (!isEligibleForPreBill) {
      toast.error('Campaign must be at 90% probability and approved to generate pre-bills')
      return
    }

    setGenerating(true)
    try {
      const payload = {
        type: preBillType,
        month: preBillType === 'monthly' ? selectedMonth : undefined,
        amount: parseFloat(preBillAmount) || campaign.budget,
        notes: preBillNotes,
      }

      const response = await fetch(`/api/campaigns/${campaignId}/pre-bills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Pre-bill generated successfully')
        setDialogOpen(false)
        fetchPreBills()
        // Reset form
        setPreBillType('campaign')
        setSelectedMonth('')
        setPreBillAmount('')
        setPreBillNotes('')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to generate pre-bill')
      }
    } catch (error) {
      console.error('Error generating pre-bill:', error)
      toast.error('Failed to generate pre-bill')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadPreBill = async (preBillId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pre-bills/${preBillId}/download`)
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pre-bill-${campaign.name}-${preBillId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Pre-bill downloaded')
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('Failed to download pre-bill')
    }
  }

  const handleEmailPreBill = async (preBillId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pre-bills/${preBillId}/email`, {
        method: 'POST',
      })

      if (response.ok) {
        toast.success('Pre-bill sent via email')
        fetchPreBills()
      } else {
        toast.error('Failed to send pre-bill')
      }
    } catch (error) {
      console.error('Email failed:', error)
      toast.error('Failed to send pre-bill')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'sent':
        return 'warning'
      case 'draft':
      default:
        return 'default'
    }
  }

  // Calculate current month for monthly pre-billing
  const currentMonth = format(new Date(), 'yyyy-MM')

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Pre-Bill Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate and manage pre-bills for cash-in-advance payments
          </Typography>
        </Box>
        {canGeneratePreBill && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={!isEligibleForPreBill}
          >
            Generate Pre-Bill
          </Button>
        )}
      </Box>

      {/* Eligibility Alert */}
      {!isEligibleForPreBill && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Pre-Bill Not Available</AlertTitle>
          Pre-bills can only be generated when:
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            <li>Campaign probability is at 90% or higher (current: {campaign.probability}%)</li>
            <li>Campaign is approved by admin (current: {campaign.approvalStatus || 'pending'})</li>
          </ul>
        </Alert>
      )}

      {/* Permission Alert */}
      {!canGeneratePreBill && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Limited Access</AlertTitle>
          Only Sellers, Admins, and Master users can generate pre-bills. You can view existing pre-bills below.
        </Alert>
      )}

      {/* Summary Cards */}
      {preBills.length > 0 && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <ReceiptIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Pre-Bills
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {preBills.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <MoneyIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Amount
                  </Typography>
                </Box>
                <Typography variant="h6">
                  ${preBills.reduce((sum, pb) => sum + pb.amount, 0).toLocaleString('en-US')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <CheckCircleIcon color="success" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Paid
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {preBills.filter(pb => pb.status === 'paid').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <WarningIcon color="warning" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Pending
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {preBills.filter(pb => pb.status !== 'paid').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Pre-Bills Table */}
      {preBills.length > 0 ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Pre-Bill History
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Sent</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preBills.map((preBill) => (
                  <TableRow key={preBill.id}>
                    <TableCell>
                      <Chip 
                        label={preBill.type === 'campaign' ? 'Full Campaign' : 'Monthly'} 
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {preBill.type === 'monthly' && preBill.month
                        ? format(new Date(preBill.month + '-01'), 'MMM yyyy')
                        : 'Full Campaign'}
                    </TableCell>
                    <TableCell>
                      ${preBill.amount.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={preBill.status} 
                        size="small"
                        color={getStatusColor(preBill.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(preBill.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {preBill.sentAt 
                        ? format(new Date(preBill.sentAt), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {preBill.notes || '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadPreBill(preBill.id)}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        {preBill.status === 'draft' && canGeneratePreBill && (
                          <Tooltip title="Send via Email">
                            <IconButton
                              size="small"
                              onClick={() => handleEmailPreBill(preBill.id)}
                            >
                              <EmailIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ReceiptIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Pre-Bills Generated
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {isEligibleForPreBill
                ? 'Generate a pre-bill when the advertiser needs to pay cash-in-advance'
                : 'Pre-bills will be available when the campaign reaches 90% probability and is approved'}
            </Typography>
            {canGeneratePreBill && isEligibleForPreBill && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
              >
                Generate First Pre-Bill
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Section */}
      <Box mt={3}>
        <Alert severity="info" icon={<InfoIcon />}>
          <AlertTitle>About Pre-Bills</AlertTitle>
          Pre-bills are generated for advertisers who need to pay cash-in-advance. They can be created:
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            <li><strong>By Campaign:</strong> Generate a pre-bill for the entire campaign amount</li>
            <li><strong>By Month:</strong> Generate monthly pre-bills for campaigns spanning multiple months</li>
          </ul>
          Pre-bills are only available when campaigns reach 90% probability and are approved by admin.
        </Alert>
      </Box>

      {/* Generate Pre-Bill Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Pre-Bill</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Pre-Bill Type</InputLabel>
              <Select
                value={preBillType}
                onChange={(e) => setPreBillType(e.target.value as 'campaign' | 'monthly')}
                label="Pre-Bill Type"
              >
                <MenuItem value="campaign">Full Campaign</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>

            {preBillType === 'monthly' && (
              <TextField
                fullWidth
                label="Month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 3 }}
                helperText="Select the month for this pre-bill"
              />
            )}

            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={preBillAmount}
              onChange={(e) => setPreBillAmount(e.target.value)}
              InputProps={{
                startAdornment: '$',
              }}
              sx={{ mb: 3 }}
              helperText={`Campaign budget: $${campaign.budget?.toLocaleString('en-US') || 0}`}
            />

            <TextField
              fullWidth
              label="Notes (Optional)"
              multiline
              rows={3}
              value={preBillNotes}
              onChange={(e) => setPreBillNotes(e.target.value)}
              helperText="Add any special instructions or notes for this pre-bill"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGeneratePreBill} 
            variant="contained"
            disabled={generating || (preBillType === 'monthly' && !selectedMonth)}
          >
            {generating ? 'Generating...' : 'Generate Pre-Bill'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}