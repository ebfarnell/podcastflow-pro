'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Upload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Send as SendIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { AdminOnly } from '@/components/auth/RoleGuard'
import { UserRole } from '@/types/auth'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/services/api'

interface ImportUser {
  name: string
  email: string
  role: UserRole
  phone?: string
  status?: 'pending' | 'success' | 'error'
  message?: string
}

export default function UserImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [parsedUsers, setParsedUsers] = useState<ImportUser[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importing, setImporting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [importResults, setImportResults] = useState<{
    total: number
    successful: number
    failed: number
    details: ImportUser[]
  } | null>(null)

  // Download template
  const handleDownloadTemplate = () => {
    const template = `Name,Email,Role,Phone
John Doe,john@example.com,admin,(555) 123-4567
Jane Smith,jane@example.com,client,
Bob Producer,bob@example.com,producer,(555) 987-6543
Mary Talent,mary@example.com,talent,
Sales Person,sales@example.com,sales,`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Parse CSV/Excel file
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setValidationErrors([])
    setParsedUsers([])
    setImportResults(null)

    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
    
    if (fileExt === 'csv') {
      parseCSV(selectedFile)
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      parseExcel(selectedFile)
    } else {
      setValidationErrors(['Please upload a CSV or Excel file'])
    }
  }

  const parseCSV = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        setValidationErrors(['File must contain headers and at least one user'])
        return
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
      const requiredHeaders = ['name', 'email', 'role']
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      if (missingHeaders.length > 0) {
        setValidationErrors([`Missing required headers: ${missingHeaders.join(', ')}`])
        return
      }

      const users: ImportUser[] = []
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        
        const user: ImportUser = {
          name: values[headers.indexOf('name')] || '',
          email: values[headers.indexOf('email')] || '',
          role: (values[headers.indexOf('role')] || 'client') as UserRole,
          phone: values[headers.indexOf('phone')] || undefined,
          status: 'pending'
        }

        // Validate user data
        if (!user.name || !user.email) {
          errors.push(`Row ${i + 1}: Name and email are required`)
          continue
        }

        if (!validateEmail(user.email)) {
          errors.push(`Row ${i + 1}: Invalid email format`)
          continue
        }

        const validRoles: UserRole[] = ['admin', 'sales', 'producer', 'talent', 'client']
        if (!validRoles.includes(user.role)) {
          errors.push(`Row ${i + 1}: Invalid role. Must be one of: ${validRoles.join(', ')}`)
          continue
        }

        users.push(user)
      }

      setValidationErrors(errors)
      setParsedUsers(users)
    }
    reader.readAsText(file)
  }

  const parseExcel = async (file: File) => {
    try {
      // Dynamically import xlsx to avoid SSR issues
      const XLSX = await import('xlsx')
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
        
        if (jsonData.length < 2) {
          setValidationErrors(['File must contain headers and at least one user'])
          return
        }

        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim())
        const requiredHeaders = ['name', 'email', 'role']
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
        if (missingHeaders.length > 0) {
          setValidationErrors([`Missing required headers: ${missingHeaders.join(', ')}`])
          return
        }

        const users: ImportUser[] = []
        const errors: string[] = []

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || row.length === 0) continue

          const user: ImportUser = {
            name: String(row[headers.indexOf('name')] || '').trim(),
            email: String(row[headers.indexOf('email')] || '').trim(),
            role: (String(row[headers.indexOf('role')] || 'client').trim()) as UserRole,
            phone: row[headers.indexOf('phone')] ? String(row[headers.indexOf('phone')]).trim() : undefined,
            status: 'pending'
          }

          // Validate user data
          if (!user.name || !user.email) {
            errors.push(`Row ${i + 1}: Name and email are required`)
            continue
          }

          if (!validateEmail(user.email)) {
            errors.push(`Row ${i + 1}: Invalid email format`)
            continue
          }

          const validRoles: UserRole[] = ['admin', 'sales', 'producer', 'talent', 'client']
          if (!validRoles.includes(user.role)) {
            errors.push(`Row ${i + 1}: Invalid role. Must be one of: ${validRoles.join(', ')}`)
            continue
          }

          users.push(user)
        }

        setValidationErrors(errors)
        setParsedUsers(users)
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      setValidationErrors(['Failed to parse Excel file'])
    }
  }

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Import users
  const importUsersMutation = useMutation({
    mutationFn: async (users: ImportUser[]) => {
      setImporting(true)
      setImportProgress(0)
      
      const results: ImportUser[] = []
      let successful = 0
      let failed = 0

      for (let i = 0; i < users.length; i++) {
        const user = users[i]
        
        try {
          const response = await api.post('/users', {
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone
          })

          results.push({
            ...user,
            status: 'success',
            message: response.emailSent ? 'User created and invitation sent' : 'User created (email failed)'
          })
          successful++
        } catch (error: any) {
          results.push({
            ...user,
            status: 'error',
            message: error.response?.data?.error || 'Failed to create user'
          })
          failed++
        }

        setImportProgress(((i + 1) / users.length) * 100)
      }

      return {
        total: users.length,
        successful,
        failed,
        details: results
      }
    },
    onSuccess: (data) => {
      setImporting(false)
      setImportResults(data)
    },
    onError: () => {
      setImporting(false)
      setValidationErrors(['Import failed. Please try again.'])
    }
  })

  const handleImport = () => {
    if (parsedUsers.length === 0) return
    importUsersMutation.mutate(parsedUsers)
  }

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'error'
      case 'sales': return 'success'
      case 'producer': return 'warning'
      case 'talent': return 'secondary'
      case 'client': return 'primary'
      default: return 'default'
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.USERS_CREATE}>
      <AdminOnly>
        <DashboardLayout>
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                  Bulk User Import
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Import multiple users at once from a CSV or Excel file
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadTemplate}
                >
                  Download Template
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => router.push('/admin/users')}
                >
                  Back to Users
                </Button>
              </Box>
            </Box>

            {/* File Upload */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<UploadIcon />}
                    size="large"
                  >
                    Upload CSV or Excel File
                  </Button>
                </label>
                {file && (
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Selected file: {file.name}
                  </Typography>
                )}
              </Box>
            </Paper>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Validation Errors:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Parsed Users Preview */}
            {parsedUsers.length > 0 && !importResults && (
              <Paper sx={{ mb: 3 }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="h6">
                    Preview ({parsedUsers.length} users)
                  </Typography>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Phone</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parsedUsers.map((user, index) => (
                        <TableRow key={index}>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={user.role}
                              size="small"
                              color={getRoleColor(user.role)}
                            />
                          </TableCell>
                          <TableCell>{user.phone || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    onClick={handleImport}
                    disabled={importing}
                  >
                    Import {parsedUsers.length} Users
                  </Button>
                </Box>
              </Paper>
            )}

            {/* Import Progress */}
            {importing && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="body1" gutterBottom>
                  Importing users...
                </Typography>
                <LinearProgress variant="determinate" value={importProgress} />
                <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                  {Math.round(importProgress)}%
                </Typography>
              </Paper>
            )}

            {/* Import Results */}
            {importResults && (
              <Paper>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="h6">
                    Import Results
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={`${importResults.successful} Successful`}
                      color="success"
                    />
                    <Chip
                      icon={<ErrorIcon />}
                      label={`${importResults.failed} Failed`}
                      color="error"
                    />
                  </Box>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Message</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importResults.details.map((user, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {user.status === 'success' ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              <ErrorIcon color="error" />
                            )}
                          </TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={user.role}
                              size="small"
                              color={getRoleColor(user.role)}
                            />
                          </TableCell>
                          <TableCell>{user.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFile(null)
                      setParsedUsers([])
                      setImportResults(null)
                      setValidationErrors([])
                    }}
                  >
                    Import More Users
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => router.push('/admin/users')}
                  >
                    View All Users
                  </Button>
                </Box>
              </Paper>
            )}
          </Box>
        </DashboardLayout>
      </AdminOnly>
    </RouteProtection>
  )
}