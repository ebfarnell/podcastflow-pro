'use client'

import { useState } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Alert,
  Grid,
  Paper
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Description as DocumentIcon
} from '@mui/icons-material'
import FileUpload from '@/components/files/FileUpload'
import FileBrowser from '@/components/files/FileBrowser'

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
      id={`files-tabpanel-${index}`}
      aria-labelledby={`files-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export function FileManagerSettings() {
  const [tabValue, setTabValue] = useState(0)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const categories = [
    { value: '', label: 'All Files', icon: <FileIcon /> },
    { value: 'document', label: 'Documents', icon: <DocumentIcon /> },
    { value: 'image', label: 'Images', icon: <ImageIcon /> },
    { value: 'audio', label: 'Audio', icon: <AudioIcon /> },
    { value: 'video', label: 'Video', icon: <VideoIcon /> }
  ]

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleUploadSuccess = (file: any) => {
    setSuccessMessage(`File "${file.originalName}" uploaded successfully!`)
    setRefreshTrigger(prev => prev + 1)
    setTimeout(() => setSuccessMessage(null), 5000)
  }

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error)
  }

  const handleFileDelete = (fileId: string) => {
    setSuccessMessage('File deleted successfully!')
    setRefreshTrigger(prev => prev + 1)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleFileUpdate = (file: any) => {
    setSuccessMessage('File updated successfully!')
    setRefreshTrigger(prev => prev + 1)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const openUploadDialog = (category: string = '') => {
    setSelectedCategory(category)
    setUploadDialogOpen(true)
  }

  const getFileStats = () => {
    // This would typically come from an API call
    return {
      totalFiles: 0,
      totalSize: '0 MB',
      recentUploads: 0
    }
  }

  const stats = getFileStats()

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            File Manager
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manage your organization's files and documents
          </Typography>

          {/* Success Message */}
          {successMessage && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}

          {/* File Statistics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {stats.totalFiles}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Files
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {stats.totalSize}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Size
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {stats.recentUploads}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Recent Uploads
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => openUploadDialog()}
                  fullWidth
                >
                  Quick Upload
                </Button>
              </Paper>
            </Grid>
          </Grid>

          {/* Category Filters */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              File Categories
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {categories.map((category) => (
                <Chip
                  key={category.value}
                  icon={category.icon}
                  label={category.label}
                  onClick={() => {
                    setTabValue(0) // Switch to browse tab
                    setSelectedCategory(category.value)
                  }}
                  variant={selectedCategory === category.value ? 'filled' : 'outlined'}
                  color={selectedCategory === category.value ? 'primary' : 'default'}
                  clickable
                />
              ))}
            </Stack>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<UploadIcon />}
                onClick={() => openUploadDialog('document')}
              >
                Upload Documents
              </Button>
              <Button
                size="small"
                startIcon={<UploadIcon />}
                onClick={() => openUploadDialog('audio')}
              >
                Upload Audio
              </Button>
              <Button
                size="small"
                startIcon={<UploadIcon />}
                onClick={() => openUploadDialog('image')}
              >
                Upload Images
              </Button>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="file management tabs">
              <Tab 
                label="Browse Files" 
                icon={<FolderIcon />} 
                iconPosition="start"
              />
              <Tab 
                label="Upload Files" 
                icon={<UploadIcon />} 
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Browse Files Tab */}
          <TabPanel value={tabValue} index={0}>
            <FileBrowser
              key={`${selectedCategory}-${refreshTrigger}`}
              category={selectedCategory || undefined}
              onFileDelete={handleFileDelete}
              onFileUpdate={handleFileUpdate}
              allowDelete={true}
              allowEdit={true}
            />
          </TabPanel>

          {/* Upload Files Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Upload New Files
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload documents, images, audio files, and videos. Files are automatically categorized based on their type.
              </Typography>
              
              <FileUpload
                onUpload={handleUploadSuccess}
                onError={handleUploadError}
                category="general"
                maxSize={100}
                multiple={true}
              />
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Upload Files
          {selectedCategory && ` - ${categories.find(c => c.value === selectedCategory)?.label}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FileUpload
              onUpload={(file) => {
                handleUploadSuccess(file)
                setUploadDialogOpen(false)
              }}
              onError={handleUploadError}
              category={selectedCategory || 'general'}
              maxSize={100}
              multiple={true}
              acceptedTypes={
                selectedCategory === 'document' ? [
                  'application/pdf',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'text/plain'
                ] : selectedCategory === 'image' ? [
                  'image/*'
                ] : selectedCategory === 'audio' ? [
                  'audio/*'
                ] : selectedCategory === 'video' ? [
                  'video/*'
                ] : ['*/*']
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}