'use client'

import { Container, Typography, Box, Paper } from '@mui/material'
import Link from 'next/link'

export default function TermsOfService() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Terms of Service
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Last Updated: July 1, 2025
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            1. Acceptance of Terms
          </Typography>
          <Typography paragraph>
            By accessing and using PodcastFlow Pro ("Service"), you accept and agree to be bound by the terms 
            and provision of this agreement. If you do not agree to abide by the above, please do not use this Service.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            2. Use License
          </Typography>
          <Typography paragraph>
            Permission is granted to temporarily access the Service for personal, non-commercial transitory viewing only. 
            This is the grant of a license, not a transfer of title, and under this license you may not:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>modify or copy the materials</li>
            <li>use the materials for any commercial purpose or for any public display</li>
            <li>attempt to reverse engineer any software contained in the Service</li>
            <li>remove any copyright or other proprietary notations from the materials</li>
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            3. Account Responsibilities
          </Typography>
          <Typography paragraph>
            You are responsible for maintaining the confidentiality of your account and password. You agree to accept 
            responsibility for all activities that occur under your account. You must notify us immediately of any 
            unauthorized use of your account.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            4. Payment Terms
          </Typography>
          <Typography paragraph>
            Paid services are billed in advance on a monthly or annual basis and are non-refundable. There will be no 
            refunds or credits for partial months of service, upgrade/downgrade refunds, or refunds for months unused 
            with an open account.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            5. Privacy Policy
          </Typography>
          <Typography paragraph>
            Your use of the Service is also governed by our Privacy Policy. Please review our{' '}
            <Link href="/privacy" style={{ color: '#1976d2' }}>
              Privacy Policy
            </Link>
            , which also governs the Site and informs users of our data collection practices.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            6. Prohibited Uses
          </Typography>
          <Typography paragraph>
            You may not use the Service:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
            <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
            <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
            <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
            <li>To submit false or misleading information</li>
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            7. Intellectual Property
          </Typography>
          <Typography paragraph>
            The Service and its original content, features, and functionality are and will remain the exclusive 
            property of PodcastFlow Pro and its licensors. The Service is protected by copyright, trademark, 
            and other laws. Our trademarks may not be used in connection with any product or service without 
            our prior written consent.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            8. Limitation of Liability
          </Typography>
          <Typography paragraph>
            In no event shall PodcastFlow Pro, nor its directors, employees, partners, agents, suppliers, or 
            affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, 
            including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            9. Termination
          </Typography>
          <Typography paragraph>
            We may terminate or suspend your account and bar access to the Service immediately, without prior 
            notice or liability, under our sole discretion, for any reason whatsoever and without limitation, 
            including but not limited to a breach of the Terms.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            10. Changes to Terms
          </Typography>
          <Typography paragraph>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a 
            revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            11. Contact Information
          </Typography>
          <Typography paragraph>
            If you have any questions about these Terms, please contact us at:
          </Typography>
          <Typography>
            Email: legal@podcastflow.pro<br />
            Address: [Your Business Address]<br />
            Phone: [Your Business Phone]
          </Typography>
        </Box>
      </Paper>
    </Container>
  )
}