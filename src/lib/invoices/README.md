# Campaign Billing & Invoice System

## Overview
Comprehensive billing automation system for campaign-based invoicing, payment processing, and commission management.

## Components

### 1. Campaign Billing Service (`campaign-billing.ts`)
Core service class that handles all campaign billing operations.

#### Key Methods:
- `createCampaignInvoice()` - Generate invoices for campaigns
- `processCampaignPayment()` - Process payments with automatic invoice creation
- `generateMonthlyRecurringInvoices()` - Automated monthly billing
- `calculateAgencyCommission()` - Commission tracking for agencies
- `getCampaignBillingMetrics()` - Financial metrics and reporting
- `validateCampaignForBilling()` - Eligibility checks

### 2. PDF Invoice Generator (`pdf-generator.ts`)
Professional PDF invoice generation using jsPDF.

#### Features:
- Company branding and headers
- Status color coding (paid/pending/overdue)
- Itemized billing with quantities and pricing
- Tax calculations and totals
- Payment terms and notes
- Multi-page support

### 3. API Endpoints

#### Campaign-Specific Billing
- `GET /api/campaigns/[id]/billing` - Get campaign billing info
- `POST /api/campaigns/[id]/billing` - Process campaign payment
- `POST /api/campaigns/[id]/invoice` - Create campaign invoice

#### Master Billing Management
- `POST /api/master/billing/monthly-invoices` - Generate monthly invoices
- `GET /api/master/billing/monthly-invoices` - Get monthly invoice status
- `GET /api/master/billing/commissions` - Agency commission overview
- `POST /api/master/billing/commissions` - Mark commissions as paid

#### Bulk Operations
- `POST /api/campaigns/billing/bulk` - Bulk payment processing
- `PUT /api/campaigns/billing/bulk` - Bulk invoice creation

#### Automation
- `POST /api/cron/monthly-billing` - Automated monthly billing (cron)
- `GET /api/cron/monthly-billing` - Check billing status

## Database Integration

### Models Used:
- **Campaign** - Base campaign information and budgets
- **Invoice** - Generated invoices with status tracking
- **InvoiceItem** - Line items linked to campaigns
- **Payment** - Payment records with transaction details
- **CampaignAnalytics** - Performance metrics for billing calculations
- **Expense** - Commission and expense tracking
- **Advertiser** - Client billing information
- **Agency** - Partner commission management

### Key Relationships:
```
Campaign -> CampaignAnalytics (1:many)
Campaign -> InvoiceItem (1:many)
Invoice -> InvoiceItem (1:many)
Invoice -> Payment (1:many)
Agency -> Campaign (1:many)
Advertiser -> Campaign (1:many)
```

## Billing Workflows

### 1. Manual Payment Processing
```typescript
// Process a single campaign payment
const result = await campaignBillingService.processCampaignPayment({
  campaignId: 'camp_123',
  amount: 5000.00,
  paymentMethod: 'bank_transfer',
  transactionId: 'txn_abc123',
  notes: 'Q1 2025 payment'
})
```

### 2. Monthly Recurring Billing
```typescript
// Generate all monthly invoices
const results = await campaignBillingService.generateMonthlyRecurringInvoices()

// Generate for specific organization
const results = await campaignBillingService.generateMonthlyRecurringInvoices('org_123')
```

### 3. Bulk Payment Processing
```typescript
// Process multiple payments at once
const payments = [
  { campaignId: 'camp_1', amount: 1000, paymentMethod: 'credit_card' },
  { campaignId: 'camp_2', amount: 2000, paymentMethod: 'bank_transfer' }
]

const response = await fetch('/api/campaigns/billing/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ payments })
})
```

### 4. Commission Calculation
```typescript
// Automatically calculated when processing payments
// Creates expense records for agency commissions
const commission = await campaignBillingService.calculateAgencyCommission(
  'camp_123',
  5000.00  // payment amount
)
```

## Automation Setup

### Monthly Billing Cron Job
Set up a cron job to run monthly billing on the 1st of each month:

```bash
# Add to crontab
0 2 1 * * curl -X POST -H "Authorization: Bearer podcastflow-cron-2025" \
  https://app.podcastflow.pro/api/cron/monthly-billing
```

### Environment Variables
```bash
CRON_SECRET=podcastflow-cron-2025  # For cron job authentication
```

## Error Handling

### Payment Processing Errors
- Invalid campaign ID
- Insufficient campaign details
- Database connection issues
- Invoice creation failures

### Commission Calculation Errors
- Missing agency information
- Invalid commission rates
- Expense creation failures

### Monthly Billing Errors
- Campaign eligibility issues
- Duplicate invoice prevention
- Bulk operation failures

## Security Features

### Authentication
- All endpoints require valid authentication
- Master-only endpoints for sensitive operations
- Cron endpoints use secret token authentication

### Data Validation
- Campaign eligibility checks
- Payment amount validation
- Commission rate verification
- Duplicate invoice prevention

### Audit Trail
- All operations logged with timestamps
- Payment transaction tracking
- Commission calculation records
- Invoice generation history

## Monitoring & Reporting

### Financial Metrics
- Total revenue by organization
- Campaign profitability analysis
- Commission expense tracking
- Payment success rates

### Operational Metrics
- Invoice generation statistics
- Payment processing times
- Commission calculation accuracy
- Monthly billing completion rates

## Usage Examples

### Basic Invoice Creation
```typescript
const invoice = await campaignBillingService.createCampaignInvoice({
  campaignId: 'camp_123',
  amount: 2500.00,
  notes: 'Q1 advertising services',
  paymentTerms: 'Net 30'
})
```

### Payment with Commission
```typescript
const result = await campaignBillingService.processCampaignPayment({
  campaignId: 'camp_123',
  amount: 2500.00,
  paymentMethod: 'bank_transfer'
})

// Commission automatically calculated if agency exists
```

### Billing Metrics
```typescript
const metrics = await campaignBillingService.getCampaignBillingMetrics('camp_123')
console.log(metrics)
// {
//   totalBilled: 15000,
//   totalPaid: 12000,
//   remainingBudget: 3000,
//   budgetUtilization: 80
// }
```

## Future Enhancements

### Planned Features
- Automated payment retry logic
- Multiple payment method support
- Advanced commission structures
- Revenue recognition rules
- Tax calculation integration
- Multi-currency support

### Integration Opportunities
- Stripe payment processing
- QuickBooks accounting sync
- Automated dunning management
- Customer payment portals
- Real-time payment notifications

## Support

For issues or questions about the billing system:
1. Check the logs in PM2: `pm2 logs podcastflow-pro`
2. Verify database connections
3. Check API endpoint responses
4. Review commission calculations
5. Validate campaign eligibility