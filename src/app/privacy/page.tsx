'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { Container, Typography, Box, Paper } from '@mui/material'

export default function PrivacyPolicy() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Privacy Policy
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Last Updated: July 1, 2025
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            1. Information We Collect
          </Typography>
          <Typography paragraph>
            We collect information you provide directly to us, such as when you create an account, 
            use our services, make a purchase, or contact us for support.
          </Typography>
          <Typography paragraph>
            The types of information we may collect include:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Name, email address, and password</li>
            <li>Company information and billing address</li>
            <li>Payment information (processed securely through Stripe)</li>
            <li>Campaign data and analytics you create within the platform</li>
            <li>Communications between you and PodcastFlow Pro</li>
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            2. How We Use Your Information
          </Typography>
          <Typography paragraph>
            We use the information we collect to:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send technical notices, updates, security alerts, and support messages</li>
            <li>Respond to your comments, questions, and provide customer service</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our services</li>
            <li>Personalize and improve the services and provide content or features that match user profiles</li>
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            3. Information Sharing and Disclosure
          </Typography>
          <Typography paragraph>
            We do not sell, trade, or rent your personal information to third parties. We may share your 
            information in the following circumstances:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>With your consent or at your direction</li>
            <li>With third party vendors and service providers that perform services on our behalf</li>
            <li>To comply with legal obligations</li>
            <li>To protect and defend our rights and property</li>
            <li>With your employer or organization if you use our enterprise services</li>
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            4. Data Security
          </Typography>
          <Typography paragraph>
            We take reasonable measures to help protect information about you from loss, theft, misuse, 
            unauthorized access, disclosure, alteration, and destruction. Your data is encrypted in transit 
            and at rest using industry-standard encryption methods.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            5. Data Retention
          </Typography>
          <Typography paragraph>
            We retain your information for as long as your account is active or as needed to provide you 
            services. We will retain and use your information as necessary to comply with our legal obligations, 
            resolve disputes, and enforce our agreements.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            6. Your Rights
          </Typography>
          <Typography paragraph>
            You have the right to:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Access and receive a copy of your personal data</li>
            <li>Correct inaccurate personal data</li>
            <li>Request deletion of your personal data</li>
            <li>Object to or restrict processing of your personal data</li>
            <li>Port your data to another service</li>
            <li>Withdraw consent at any time</li>
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            7. Cookies and Tracking Technologies
          </Typography>
          <Typography paragraph>
            We use cookies and similar tracking technologies to track activity on our service and hold 
            certain information. You can instruct your browser to refuse all cookies or to indicate when 
            a cookie is being sent.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            8. Third-Party Services
          </Typography>
          <Typography paragraph>
            Our service may contain links to third-party websites and services. We are not responsible for 
            the privacy practices or content of these third-party sites. We encourage you to review their 
            privacy policies.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            9. International Data Transfers
          </Typography>
          <Typography paragraph>
            Your information may be transferred to and maintained on computers located outside of your state, 
            province, country, or other governmental jurisdiction where data protection laws may differ. Your 
            consent to this Privacy Policy followed by your submission of information represents your agreement 
            to such transfers.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            10. Children's Privacy
          </Typography>
          <Typography paragraph>
            Our service is not directed to individuals under the age of 18. We do not knowingly collect 
            personal information from children under 18. If we become aware that a child under 18 has 
            provided us with personal information, we will take steps to delete such information.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            11. Changes to This Privacy Policy
          </Typography>
          <Typography paragraph>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting 
            the new Privacy Policy on this page and updating the "Last Updated" date.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            12. Contact Us
          </Typography>
          <Typography paragraph>
            If you have any questions about this Privacy Policy, please contact us at:
          </Typography>
          <Typography>
            Email: privacy@podcastflow.pro<br />
            Address: [Your Business Address]<br />
            Data Protection Officer: [Name if applicable]
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            13. GDPR Compliance
          </Typography>
          <Typography paragraph>
            For users in the European Economic Area (EEA), we comply with the General Data Protection 
            Regulation (GDPR). Our legal basis for collecting and using your personal information depends 
            on the information concerned and the context in which we collect it.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            14. California Privacy Rights
          </Typography>
          <Typography paragraph>
            If you are a California resident, you have additional rights under the California Consumer Privacy 
            Act (CCPA), including the right to know what personal information we collect, the right to delete 
            your information, and the right to opt-out of the sale of your personal information (which we do not do).
          </Typography>
        </Box>
      </Paper>
    </Container>
  )
}