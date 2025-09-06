# Namecheap to AWS Route 53 Setup Guide

## Step-by-Step Instructions

### 1. **Log into Namecheap**
Go to https://www.namecheap.com and sign in to your account.

### 2. **Navigate to Domain Settings**
- Click on "Domain List" in your account
- Find "podcastflow.pro" 
- Click "Manage" button next to it

### 3. **Change Nameservers**
- Look for "NAMESERVERS" section
- Select "Custom DNS" from the dropdown
- Remove any existing nameservers
- Add these AWS Route 53 nameservers:
  ```
  ns-1821.awsdns-35.co.uk
  ns-752.awsdns-30.net
  ns-466.awsdns-58.com
  ns-1156.awsdns-16.org
  ```
- Click the green checkmark ✓ to save

### 4. **Verify Changes**
- You should see "Custom DNS" selected
- All 4 AWS nameservers should be listed
- Look for confirmation message

### 5. **Wait for DNS Propagation**
- Changes typically take 15-30 minutes
- Can take up to 48 hours in rare cases
- Most users see it working within 1 hour

## 🔍 How to Check Progress

### Check DNS Propagation:
```bash
# Check if nameservers are updated
dig NS podcastflow.pro

# Check if subdomain is resolving
dig app.podcastflow.pro

# Alternative check
nslookup app.podcastflow.pro
```

### Check Certificate Status:
```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:590183844530:certificate/6ab69690-10b8-4706-8b1a-c0cf75277926 \
  --query "Certificate.Status" \
  --output text
```

## 📱 What Happens Next

Once nameservers are updated:
1. AWS will automatically validate your SSL certificate
2. Your domain will start resolving to AWS
3. app.podcastflow.pro will point to your application
4. api.podcastflow.pro will point to your API

## 🚀 Final Deployment

Once DNS is working and certificate is validated:

```bash
cd /home/ec2-user/podcastflow-pro
./scripts/deploy-production.sh
```

Then visit: https://app.podcastflow.pro

## ⏱️ Timeline

| Step | Time |
|------|------|
| Namecheap nameserver update | Instant |
| DNS propagation starts | 5-15 minutes |
| Certificate validation | 5-30 minutes after DNS |
| Site accessible | After certificate validates |

## 🔧 Troubleshooting

### If site doesn't load after 1 hour:
1. Verify nameservers in Namecheap
2. Check certificate status in AWS
3. Clear browser cache
4. Try from different device/network

### Common Issues:
- **Certificate still pending**: DNS not propagated yet
- **Connection refused**: Application not deployed
- **Invalid certificate**: Certificate not validated yet

## 📞 Support Contacts

- **Namecheap Support**: https://www.namecheap.com/support/
- **AWS Support**: https://console.aws.amazon.com/support/

---

**Note**: Keep this guide for future reference. The nameserver change is the ONLY thing you need to do in Namecheap. Everything else is handled by AWS.