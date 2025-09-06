'use client'

import React, { useState, useRef } from 'react'
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Paper,
  Card,
  CardContent,
  IconButton,
  Chip,
  Stack
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  Description as DocumentIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon
} from '@mui/icons-material'

interface FileUploadProps {
  onUpload?: (file: any) => void
  onError?: (error: string) => void
  category?: string
  entityType?: string
  entityId?: string
  acceptedTypes?: string[]
  maxSize?: number // in MB
  multiple?: boolean
  disabled?: boolean
}

interface UploadingFile {
  file: File
  progress: number
  error?: string
  uploaded?: boolean
  result?: any
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  onError,
  category = 'general',
  entityType,
  entityId,
  acceptedTypes = ['*/*'],
  maxSize = 100,
  multiple = false,
  disabled = false
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon />
    if (mimeType.startsWith('audio/')) return <AudioIcon />
    if (mimeType.startsWith('video/')) return <VideoIcon />
    if (mimeType.includes('pdf') || mimeType.includes('document')) return <DocumentIcon />
    return <FileIcon />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize}MB limit`
    }

    // Check file type if specified
    if (acceptedTypes.length > 0 && !acceptedTypes.includes('*/*')) {
      const isAccepted = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'))
        }
        return file.type === type
      })
      
      if (!isAccepted) {
        return `File type ${file.type} is not accepted`
      }
    }

    return null
  }

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', category)
    if (entityType) formData.append('entityType', entityType)
    if (entityId) formData.append('entityId', entityId)

    try {
      const response = await fetch('/api/upload/documents', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()
      return result.file
    } catch (error) {
      throw error
    }
  }

  const handleFiles = async (files: FileList) => {
    const filesToUpload = Array.from(files)
    
    if (!multiple && filesToUpload.length > 1) {
      onError?.('Only one file can be uploaded at a time')
      return
    }

    const newUploadingFiles: UploadingFile[] = filesToUpload.map(file => {
      const error = validateFile(file)
      return {
        file,
        progress: 0,
        error: error || undefined
      }
    })

    setUploadingFiles(prev => [...prev, ...newUploadingFiles])

    // Upload files one by one
    for (let i = 0; i < newUploadingFiles.length; i++) {
      const uploadingFile = newUploadingFiles[i]
      
      if (uploadingFile.error) {
        continue
      }

      try {
        // Simulate progress for visual feedback
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => prev.map(f => 
            f.file === uploadingFile.file && f.progress < 90 
              ? { ...f, progress: f.progress + 10 }
              : f
          ))
        }, 200)

        const result = await uploadFile(uploadingFile.file)
        
        clearInterval(progressInterval)
        
        setUploadingFiles(prev => prev.map(f => 
          f.file === uploadingFile.file 
            ? { ...f, progress: 100, uploaded: true, result }
            : f
        ))

        onUpload?.(result)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        
        setUploadingFiles(prev => prev.map(f => 
          f.file === uploadingFile.file 
            ? { ...f, error: errorMessage, progress: 0 }
            : f
        ))

        onError?.(errorMessage)
      }
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input value to allow selecting the same file again
    event.target.value = ''
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    const files = event.dataTransfer.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const removeUploadingFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file))
  }

  return (
    <Box>
      {/* Drop Zone */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          textAlign: 'center',
          border: dragOver ? 2 : 1,
          borderColor: dragOver ? 'primary.main' : 'grey.300',
          borderStyle: 'dashed',
          backgroundColor: dragOver ? 'action.hover' : 'background.paper',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease-in-out'
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {dragOver ? 'Drop files here' : 'Drop files here or click to browse'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Maximum file size: {maxSize}MB
          {acceptedTypes.length > 0 && !acceptedTypes.includes('*/*') && (
            <br />
          )}
          {acceptedTypes.length > 0 && !acceptedTypes.includes('*/*') && 
            `Accepted types: ${acceptedTypes.join(', ')}`
          }
        </Typography>
        <Button
          variant="contained"
          disabled={disabled}
          startIcon={<UploadIcon />}
          onClick={(e) => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          Choose Files
        </Button>
      </Paper>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Upload Progress
          </Typography>
          <Stack spacing={1}>
            {uploadingFiles.map((uploadingFile, index) => (
              <Card key={index} variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {getFileIcon(uploadingFile.file.type)}
                    <Box sx={{ ml: 1, flex: 1 }}>
                      <Typography variant="body2" noWrap>
                        {uploadingFile.file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(uploadingFile.file.size)}
                      </Typography>
                    </Box>
                    {uploadingFile.uploaded ? (
                      <Chip label="Uploaded" color="success" size="small" />
                    ) : uploadingFile.error ? (
                      <Chip label="Error" color="error" size="small" />
                    ) : (
                      <Chip label="Uploading" color="primary" size="small" />
                    )}
                    <IconButton
                      size="small"
                      onClick={() => removeUploadingFile(uploadingFile.file)}
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  {uploadingFile.error ? (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {uploadingFile.error}
                    </Alert>
                  ) : (
                    <LinearProgress
                      variant="determinate"
                      value={uploadingFile.progress}
                      sx={{ mt: 1 }}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  )
}

export default FileUpload