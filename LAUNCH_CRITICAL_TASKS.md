# 🚨 Launch Critical Tasks - Must Complete Before Going Live

## 1. **Stripe Payment Integration** (30 minutes)

### Steps:
```bash
# 1. Create Stripe account at https://stripe.com
# 2. Get your API keys from https://dashboard.stripe.com/apikeys
# 3. Run setup script:
cd /home/ec2-user/podcastflow-pro
./infrastructure/scripts/setup-stripe.sh

# 4. When prompted, enter:
#    - Publishable key (starts with pk_test_ or pk_live_)
#    - Secret key (starts with sk_test_ or sk_live_)
```

### Test Payment:
- Use test card: 4242 4242 4242 4242
- Any future expiry date
- Any 3-digit CVC

---

## 2. **Email System Setup** (45 minutes)

### AWS SES Configuration:
```bash
# 1. Verify your domain
aws ses verify-domain-identity --domain podcastflow.pro --region us-east-1

# 2. Check verification status
aws ses get-identity-verification-attributes --identities podcastflow.pro --region us-east-1

# 3. Add DKIM records (get from AWS SES console)
# 4. Move out of sandbox (for production)
aws ses put-account-sending-attributes --production-access-enabled
```

### Quick Email Implementation:
```typescript
// Add to src/lib/email.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: "us-east-1" });

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `https://app.podcastflow.pro/verify?token=${token}`;
  
  const command = new SendEmailCommand({
    Source: "noreply@podcastflow.pro",
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: "Verify your PodcastFlow Pro account" },
      Body: {
        Html: {
          Data: `
            <h2>Welcome to PodcastFlow Pro!</h2>
            <p>Please verify your email by clicking the link below:</p>
            <a href="${verifyUrl}">Verify Email</a>
            <p>Or copy this link: ${verifyUrl}</p>
          `
        }
      }
    }
  });
  
  await ses.send(command);
}
```

---

## 3. **Update Legal Contact Information** (5 minutes)

### Edit Terms of Service:
```bash
# Edit src/app/terms/page.tsx
# Replace:
Email: legal@podcastflow.pro → your-legal@yourdomain.com
Address: [Your Business Address] → Your actual address
Phone: [Your Business Phone] → Your phone number
```

### Edit Privacy Policy:
```bash
# Edit src/app/privacy/page.tsx
# Replace:
Email: privacy@podcastflow.pro → your-privacy@yourdomain.com
Address: [Your Business Address] → Your actual address
Data Protection Officer: [Name if applicable] → Your name or "Not applicable"
```

---

## 4. **Customer Support Setup** (15 minutes)

### Option A: Simple Email Forward
```bash
# Use your domain provider to set up:
support@podcastflow.pro → your-email@gmail.com
```

### Option B: Help Desk (Recommended)
- Set up Freshdesk, Zendesk, or Intercom
- Create support@podcastflow.pro email
- Add to website footer

### Quick Support Page:
```typescript
// Create src/app/support/page.tsx
export default function Support() {
  return (
    <Container>
      <h1>Support</h1>
      <p>Email: support@podcastflow.pro</p>
      <p>Response time: Within 24 hours</p>
      <h2>Common Questions</h2>
      {/* Add FAQs */}
    </Container>
  );
}
```

---

## 🚀 Quick Launch Script

Once you complete the above, run:

```bash
#!/bin/bash
# Final pre-launch checks

echo "Running pre-launch checks..."

# 1. Check Stripe is configured
if aws secretsmanager get-secret-value --secret-id podcastflow/production/stripe --query SecretString --output text | grep -q "pk_live"; then
  echo "✅ Stripe configured for LIVE mode"
else
  echo "⚠️  Stripe in TEST mode"
fi

# 2. Check SES is configured
if aws ses describe-configuration-set --configuration-set-name default 2>/dev/null; then
  echo "✅ Email system configured"
else
  echo "❌ Email system not configured"
fi

# 3. Test email sending
aws ses send-email \
  --from noreply@podcastflow.pro \
  --to your-email@example.com \
  --subject "PodcastFlow Pro Test" \
  --text "Test email from PodcastFlow Pro" 2>/dev/null && echo "✅ Email sending works" || echo "❌ Email sending failed"

# 4. Check legal pages
if grep -q "Your Business Address" src/app/terms/page.tsx; then
  echo "❌ Legal pages need updating"
else
  echo "✅ Legal pages updated"
fi

echo ""
echo "Fix any ❌ items before launching!"
```

---

## ⏱️ Total Time: ~90 minutes

With these 4 items complete, you can legally and safely accept paying customers!

## 📋 Post-Launch Priority (Do within first week):
1. Enable 2FA for admin accounts
2. Set up automated backups
3. Configure rate limiting
4. Add Google Analytics
5. Implement audit logging