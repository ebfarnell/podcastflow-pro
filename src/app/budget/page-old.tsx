'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  LinearProgress,
  Alert
} from '@mui/material'
import {
  AccountTree,
  AttachMoney,
  TrendingUp
} from '@mui/icons-material'
import { RevenueProjections } from '@/components/budget/RevenueProjections'
import { HierarchicalBudgetGrid } from '@/components/budget/HierarchicalBudgetGrid'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`budget-tabpanel-${index}`}
      aria-labelledby={`budget-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function BudgetPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  
  // Categories State
  const [categories, setCategories] = useState<any[]>([])
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  
  // Budget Entries State
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear())
  const [budgetMonth, setBudgetMonth] = useState<number | null>(null)
  const [budgetEntries, setBudgetEntries] = useState<any[]>([])
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)
  
  // Compensation State
  const [compensations, setCompensations] = useState<any[]>([])
  const [compensationDialogOpen, setCompensationDialogOpen] = useState(false)
  const [editingCompensation, setEditingCompensation] = useState<any>(null)
  
  // Form State
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (!sessionLoading && (!user || !['master', 'admin'].includes(user.role))) {
      router.push('/dashboard')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user) {
      fetchCategories()
      fetchBudgetEntries()
      fetchCompensations()
      setLoading(false)
    }
  }, [user, budgetYear, budgetMonth])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/budget/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      setCategories(data.categories)
    } catch (err) {
      console.error('Error fetching categories:', err)
      setError('Failed to load budget categories')
    }
  }

  const fetchBudgetEntries = async () => {
    try {
      let url = `/api/budget/entries?year=${budgetYear}`
      if (budgetMonth) url += `&month=${budgetMonth}`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch budget entries')
      const data = await response.json()
      setBudgetEntries(data.entries)
    } catch (err) {
      console.error('Error fetching budget entries:', err)
      setError('Failed to load budget entries')
    }
  }

  const fetchCompensations = async () => {
    try {
      const response = await fetch(`/api/budget/compensation?year=${budgetYear}`)
      if (!response.ok) throw new Error('Failed to fetch compensation data')
      const data = await response.json()
      setCompensations(data.compensations)
    } catch (err) {
      console.error('Error fetching compensation:', err)
      setError('Failed to load compensation data')
    }
  }

  const handleCategorySubmit = async () => {
    try {
      const url = editingCategory 
        ? `/api/budget/categories/${editingCategory.id}`
        : '/api/budget/categories'
      
      const response = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to save category')
      
      setCategoryDialogOpen(false)
      setEditingCategory(null)
      setFormData({})
      fetchCategories()
    } catch (err) {
      console.error('Error saving category:', err)
      setError('Failed to save category')
    }
  }

  const handleEntrySubmit = async () => {
    try {
      if (editingEntry) {
        // Update single entry
        const response = await fetch(`/api/budget/entries/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (!response.ok) throw new Error('Failed to update entry')
      } else {
        // Create new entry
        const response = await fetch('/api/budget/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            year: budgetYear,
            month: budgetMonth || new Date().getMonth() + 1
          })
        })
        if (!response.ok) throw new Error('Failed to create entry')
      }
      
      setEntryDialogOpen(false)
      setEditingEntry(null)
      setFormData({})
      fetchBudgetEntries()
    } catch (err) {
      console.error('Error saving entry:', err)
      setError('Failed to save budget entry')
    }
  }

  const handleBatchUpdate = async () => {
    try {
      const response = await fetch('/api/budget/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: budgetEntries })
      })

      if (!response.ok) throw new Error('Failed to update entries')
      
      setEditMode(false)
      fetchBudgetEntries()
    } catch (err) {
      console.error('Error updating entries:', err)
      setError('Failed to update budget entries')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  if (sessionLoading || loading) return <LinearProgress />
  if (!user || !['master', 'admin'].includes(user.role)) return null

  return (
    <DashboardLayout>
      <RouteProtection requiredPermission={PERMISSIONS.BUDGET_VIEW}>
        <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Strategic Budget Planning
        </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} aria-label="budget tabs">
          <Tab label="Budget Planning" icon={<TrendingUp />} iconPosition="start" />
          <Tab label="Revenue Projections" icon={<AttachMoney />} iconPosition="start" />
          <Tab label="Strategic Allocations" icon={<AccountTree />} iconPosition="start" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        {/* Budget Planning Tab */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Year</InputLabel>
              <Select value={budgetYear} onChange={(e) => setBudgetYear(e.target.value as number)} label="Year">
                {[2023, 2024, 2025, 2026].map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Month</InputLabel>
              <Select 
                value={budgetMonth || ''} 
                onChange={(e) => setBudgetMonth(e.target.value ? e.target.value as number : null)} 
                label="Month"
              >
                <MenuItem value="">All Months</MenuItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setFormData({ month: budgetMonth || new Date().getMonth() + 1 })
                  setEditingEntry(null)
                  setEntryDialogOpen(true)
                }}
                fullWidth
              >
                Add Entry
              </Button>
              {budgetEntries.length > 0 && (
                <Button
                  variant={editMode ? "contained" : "outlined"}
                  startIcon={editMode ? <Save /> : <Edit />}
                  onClick={() => editMode ? handleBatchUpdate() : setEditMode(true)}
                  color={editMode ? "success" : "primary"}
                >
                  {editMode ? 'Save' : 'Edit'}
                </Button>
              )}
              {editMode && (
                <Button
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={() => {
                    setEditMode(false)
                    fetchBudgetEntries()
                  }}
                  color="error"
                >
                  Cancel
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Planning Summary Cards - Forward-Looking */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Target Revenue</Typography>
                <Typography variant="h4" color="success.main">
                  {formatCurrency(budgetEntries.filter(e => e.category.type === 'revenue').reduce((sum, e) => sum + e.budgetAmount, 0))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {budgetYear} Goal
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Investment Budget</Typography>
                <Typography variant="h4" color="primary.main">
                  {formatCurrency(budgetEntries.filter(e => e.category.type === 'expense').reduce((sum, e) => sum + e.budgetAmount, 0))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Planned Investment
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Projected Profit</Typography>
                <Typography variant="h4" color={(
                  budgetEntries.filter(e => e.category.type === 'revenue').reduce((sum, e) => sum + e.budgetAmount, 0) -
                  budgetEntries.filter(e => e.category.type === 'expense').reduce((sum, e) => sum + e.budgetAmount, 0)
                ) > 0 ? 'success.main' : 'warning.main'}>
                  {formatCurrency(
                    budgetEntries.filter(e => e.category.type === 'revenue').reduce((sum, e) => sum + e.budgetAmount, 0) -
                    budgetEntries.filter(e => e.category.type === 'expense').reduce((sum, e) => sum + e.budgetAmount, 0)
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Projected Margin
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Growth Target</Typography>
                <Typography variant="h4" color="info.main">
                  +25%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  vs Previous Year
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Strategic Planning Table - Forward-Looking Only */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Strategic Budget Allocations ({budgetYear})
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Focus on forward-looking planning and strategic investments. Historical expense tracking is available in the Financial Management Hub.
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Strategic Category</TableCell>
                    <TableCell>Type</TableCell>
                    {budgetMonth && <TableCell>Month</TableCell>}
                    <TableCell align="right">Budget Target</TableCell>
                    <TableCell align="right">Strategic Priority</TableCell>
                    <TableCell align="right">Growth Impact</TableCell>
                    {!editMode && <TableCell align="center">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {budgetEntries.map((entry, index) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {entry.category.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={entry.category.type === 'revenue' ? 'Revenue Target' : 'Investment'} 
                          size="small"
                          color={
                            entry.category.type === 'revenue' ? 'success' :
                            entry.category.type === 'expense' ? 'primary' : 'warning'
                          }
                        />
                      </TableCell>
                      {budgetMonth && <TableCell>{entry.month}</TableCell>}
                      <TableCell align="right">
                        {editMode ? (
                          <TextField
                            type="number"
                            value={entry.budgetAmount}
                            onChange={(e) => {
                              const newEntries = [...budgetEntries]
                              newEntries[index].budgetAmount = parseFloat(e.target.value) || 0
                              setBudgetEntries(newEntries)
                            }}
                            size="small"
                            sx={{ width: 120 }}
                          />
                        ) : (
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(entry.budgetAmount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={entry.budgetAmount > 100000 ? 'High' : entry.budgetAmount > 50000 ? 'Medium' : 'Low'}
                          size="small"
                          color={
                            entry.budgetAmount > 100000 ? 'error' :
                            entry.budgetAmount > 50000 ? 'warning' : 'success'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <TrendingUp color="success" sx={{ mr: 1 }} />
                          <Typography variant="body2" color="success.main">
                            +{Math.floor(entry.budgetAmount / 10000)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      {!editMode && (
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setFormData({
                                budgetAmount: entry.budgetAmount,
                                notes: entry.notes
                              })
                              setEditingEntry(entry)
                              setEntryDialogOpen(true)
                            }}
                          >
                            <Edit />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Revenue Projections Tab */}
        <RevenueProjections year={budgetYear} />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Strategic Allocations Tab */}
        <Alert severity="info" sx={{ mb: 3 }}>
          Strategic resource allocation focuses on investments that drive long-term growth and competitive advantage.
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Investment Priorities
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Strategic areas for budget allocation to maximize ROI and growth potential.
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <TrendingUp color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Technology & Infrastructure"
                      secondary="35% - Platform scaling and automation"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <People color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Talent Acquisition"
                      secondary="30% - Key hires for expansion"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AttachMoney color="warning" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Marketing & Sales"
                      secondary="25% - Market expansion initiatives"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AccountTree color="info" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="R&D & Innovation"
                      secondary="10% - Future product development"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quarterly Milestones
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Key strategic goals and budget checkpoints for {budgetYear}.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[
                    { quarter: 'Q1', goal: 'Platform optimization & team expansion', budget: '$125K' },
                    { quarter: 'Q2', goal: 'Market expansion & partnership development', budget: '$150K' },
                    { quarter: 'Q3', goal: 'Product innovation & feature rollout', budget: '$175K' },
                    { quarter: 'Q4', goal: 'Scale operations & prepare for next year', budget: '$200K' }
                  ].map((milestone, index) => (
                    <Card key={index} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="subtitle2" color="primary" fontWeight="bold">
                            {milestone.quarter} {budgetYear}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {milestone.goal}
                          </Typography>
                        </Box>
                        <Chip 
                          label={milestone.budget} 
                          color="primary" 
                          size="small" 
                        />
                      </Box>
                    </Card>
                  ))}
                </Box>
                
                <Button 
                  variant="contained" 
                  startIcon={<AccountTree />}
                  sx={{ mt: 3 }}
                  fullWidth
                >
                  Review Strategic Plan
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Category Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type || 'expense'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  label="Type"
                >
                  <MenuItem value="revenue">Revenue</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                  <MenuItem value="cogs">Cost of Goods Sold</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Parent Category</InputLabel>
                <Select
                  value={formData.parentCategoryId || ''}
                  onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
                  label="Parent Category"
                >
                  <MenuItem value="">None</MenuItem>
                  {categories
                    .filter(cat => cat.type === formData.type && cat.id !== editingCategory?.id)
                    .map(cat => (
                      <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCategorySubmit} variant="contained">
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Strategic Planning Entry Dialog */}
      <Dialog open={entryDialogOpen} onClose={() => setEntryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEntry ? 'Edit Strategic Target' : 'Add Strategic Target'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {!editingEntry && (
              <>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={formData.categoryId || ''}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      label="Category"
                    >
                      {categories.map(cat => (
                        <MenuItem key={cat.id} value={cat.id}>
                          {cat.name} ({cat.type})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={formData.month || ''}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      label="Month"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                          {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Target Amount"
                type="number"
                value={formData.budgetAmount || ''}
                onChange={(e) => setFormData({ ...formData, budgetAmount: parseFloat(e.target.value) || 0 })}
                helperText="Set your strategic target for this category"
              />
            </Grid>
            {editingEntry && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Actual Amount"
                  type="number"
                  value={formData.actualAmount || ''}
                  onChange={(e) => setFormData({ ...formData, actualAmount: parseFloat(e.target.value) || 0 })}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntryDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEntrySubmit} variant="contained">
            {editingEntry ? 'Update Target' : 'Set Target'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compensation Dialog */}
      <Dialog open={compensationDialogOpen} onClose={() => setCompensationDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingCompensation ? 'Edit Compensation' : 'Add Compensation Record'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={formData.userId || ''}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  label="Employee"
                >
                  {/* This would need to be populated with users */}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={formData.year || budgetYear}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Base Salary"
                type="number"
                value={formData.baseSalary || ''}
                onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Target Bonus"
                type="number"
                value={formData.targetBonus || ''}
                onChange={(e) => setFormData({ ...formData, targetBonus: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Commission Rate (%)"
                type="number"
                value={formData.commissionRate || ''}
                onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Benefits"
                type="number"
                value={formData.benefits || ''}
                onChange={(e) => setFormData({ ...formData, benefits: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Effective Date"
                type="date"
                value={formData.effectiveDate || ''}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompensationDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => {}} variant="contained">
            {editingCompensation ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
        </Box>
      </RouteProtection>
    </DashboardLayout>
  )
}