'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Alert,
  Skeleton,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material'
import {
  Description as DocumentIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Link as LinkIcon
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface FileData {
  id: string
  originalName: string
  fileName: string
  fileSize: number
  mimeType: string
  category: string
  s3Url: string
  entityType?: string
  entityId?: string
  description?: string
  uploadedBy: {
    name: string
    email: string
    role: string
  }
  createdAt: string
  downloadUrl?: string
}

interface FileBrowserProps {
  category?: string
  entityType?: string
  entityId?: string
  onFileSelect?: (file: FileData) => void
  onFileDelete?: (fileId: string) => void
  onFileUpdate?: (file: FileData) => void
  selectable?: boolean
  allowDelete?: boolean
  allowEdit?: boolean
}

const FileBrowser: React.FC<FileBrowserProps> = ({
  category,
  entityType,
  entityId,
  onFileSelect,
  onFileDelete,
  onFileUpdate,
  selectable = false,
  allowDelete = true,
  allowEdit = true
}) => {
  const [files, setFiles] = useState<FileData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalFiles, setTotalFiles] = useState(0)
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null)
  const [editForm, setEditForm] = useState({ description: '', entityType: '', entityId: '' })
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [menuFile, setMenuFile] = useState<FileData | null>(null)

  const getFileIcon = (mimeType: string, size: 'small' | 'medium' = 'medium') => {
    const iconProps = { fontSize: size }
    if (mimeType.startsWith('image/')) return <ImageIcon {...iconProps} color="primary" />
    if (mimeType.startsWith('audio/')) return <AudioIcon {...iconProps} color="secondary" />
    if (mimeType.startsWith('video/')) return <VideoIcon {...iconProps} color="error" />
    if (mimeType.includes('pdf') || mimeType.includes('document')) return <DocumentIcon {...iconProps} color="info" />
    return <FileIcon {...iconProps} />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const loadFiles = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString()
      })
      
      if (category) params.set('category', category)
      if (entityType) params.set('entityType', entityType)
      if (entityId) params.set('entityId', entityId)

      const response = await fetch(`/api/upload/documents?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load files')
      }

      const data = await response.json()
      setFiles(data.files || [])
      setTotalFiles(data.pagination?.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [page, rowsPerPage, category, entityType, entityId])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, file: FileData) => {
    setAnchorEl(event.currentTarget)
    setMenuFile(file)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setMenuFile(null)
  }

  const handleEdit = (file: FileData) => {
    setSelectedFile(file)
    setEditForm({
      description: file.description || '',
      entityType: file.entityType || '',
      entityId: file.entityId || ''
    })
    setEditDialogOpen(true)
    handleMenuClose()
  }

  const handleDelete = (file: FileData) => {
    setSelectedFile(file)
    setDeleteDialogOpen(true)
    handleMenuClose()
  }

  const handleView = async (file: FileData) => {
    try {
      // Get file with download URL
      const response = await fetch(`/api/files/${file.id}`)
      if (response.ok) {
        const data = await response.json()
        window.open(data.file.downloadUrl || file.s3Url, '_blank')
      }
    } catch (error) {
      console.error('Error viewing file:', error)
    }
    handleMenuClose()
  }

  const handleDownload = async (file: FileData) => {
    try {
      // Get file with download URL
      const response = await fetch(`/api/files/${file.id}`)
      if (response.ok) {
        const data = await response.json()
        const link = document.createElement('a')
        link.href = data.file.downloadUrl || file.s3Url
        link.download = file.originalName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (error) {
      console.error('Error downloading file:', error)
    }
    handleMenuClose()
  }

  const handleCopyLink = async (file: FileData) => {
    try {
      await navigator.clipboard.writeText(file.s3Url)
      // Could show a toast notification here
    } catch (error) {
      console.error('Error copying link:', error)
    }
    handleMenuClose()
  }

  const saveEditChanges = async () => {
    if (!selectedFile) return

    try {
      const response = await fetch(`/api/files/${selectedFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (response.ok) {
        const data = await response.json()
        onFileUpdate?.(data.file)
        loadFiles() // Refresh the list
        setEditDialogOpen(false)
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to update file')
      }
    } catch (err) {
      setError('Failed to update file')
    }
  }

  const confirmDelete = async () => {
    if (!selectedFile) return

    try {
      const response = await fetch(`/api/files/${selectedFile.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onFileDelete?.(selectedFile.id)
        loadFiles() // Refresh the list
        setDeleteDialogOpen(false)
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to delete file')
      }
    } catch (err) {
      setError('Failed to delete file')
    }
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>File</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Uploaded By</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: rowsPerPage }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                    </TableRow>
                  ))
                ) : files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No files found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((file) => (
                    <TableRow 
                      key={file.id}
                      hover={selectable}
                      sx={{ cursor: selectable ? 'pointer' : 'default' }}
                      onClick={() => selectable && onFileSelect?.(file)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getFileIcon(file.mimeType, 'small')}
                          <Box sx={{ ml: 2 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {file.originalName}
                            </Typography>
                            {file.description && (
                              <Typography variant="caption" color="text.secondary">
                                {file.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatFileSize(file.fileSize)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={file.category} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {file.uploadedBy.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {file.uploadedBy.role}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMenuOpen(e, file)
                          }}
                        >
                          <MoreIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={totalFiles}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value))
              setPage(0)
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => menuFile && handleView(menuFile)}>
          <ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuFile && handleDownload(menuFile)}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuFile && handleCopyLink(menuFile)}>
          <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Copy Link</ListItemText>
        </MenuItem>
        {allowEdit && (
          <>
            <Divider />
            <MenuItem onClick={() => menuFile && handleEdit(menuFile)}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          </>
        )}
        {allowDelete && (
          <MenuItem onClick={() => menuFile && handleDelete(menuFile)}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit File Details</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Description"
              multiline
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Entity Type"
              value={editForm.entityType}
              onChange={(e) => setEditForm(prev => ({ ...prev, entityType: e.target.value }))}
              fullWidth
              placeholder="e.g., campaign, episode, show"
            />
            <TextField
              label="Entity ID"
              value={editForm.entityId}
              onChange={(e) => setEditForm(prev => ({ ...prev, entityId: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveEditChanges} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedFile?.originalName}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default FileBrowser