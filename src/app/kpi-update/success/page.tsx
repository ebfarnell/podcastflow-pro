'use client'

import React from 'react'
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
} from '@mui/material'
import {
  CheckCircle,
  Home as HomeIcon,
} from '@mui/icons-material'

export default function KPIUpdateSuccessPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8 }}>
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 3 }} />
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
              Thank You!
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
              Your KPI update has been successfully submitted.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Your account manager has been notified of the updated metrics. 
              They will review the information and may reach out if they have any questions.
            </Typography>
            <Button
              variant="contained"
              startIcon={<HomeIcon />}
              onClick={() => window.location.href = '/'}
              size="large"
            >
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}