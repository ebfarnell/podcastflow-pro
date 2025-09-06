-- Create Master Schema for Platform-Wide Data
-- This schema contains billing, invoicing, and management data for the platform itself

-- Create the master schema
CREATE SCHEMA IF NOT EXISTS master;

-- Set search path to include master schema
SET search_path TO master, public;

-- Master Invoices (Platform invoices to organizations)
CREATE TABLE IF NOT EXISTS master."MasterInvoice" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "invoiceNumber" TEXT NOT NULL UNIQUE,
    "organizationId" TEXT NOT NULL REFERENCES public."Organization"(id),
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidDate" TIMESTAMP(3),
    
    -- Billing details
    "planName" TEXT NOT NULL,
    "planPrice" DECIMAL(10, 2) NOT NULL,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "campaignCount" INTEGER NOT NULL DEFAULT 0,
    "storageUsedGB" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Additional charges/credits
    "additionalCharges" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "credits" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "additionalChargesDescription" TEXT,
    "creditsDescription" TEXT,
    
    -- Totals
    "subtotal" DECIMAL(10, 2) NOT NULL,
    "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10, 2) NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
    "sentAt" TIMESTAMP(3),
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderSentAt" TIMESTAMP(3),
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT REFERENCES public."User"(id)
);

-- Master Payments (Payments from organizations to platform)
CREATE TABLE IF NOT EXISTS master."MasterPayment" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "paymentNumber" TEXT NOT NULL UNIQUE,
    "invoiceId" TEXT NOT NULL REFERENCES master."MasterInvoice"(id),
    "organizationId" TEXT NOT NULL REFERENCES public."Organization"(id),
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedDate" TIMESTAMP(3),
    
    -- Transaction details
    "transactionId" TEXT,
    "processorFee" DECIMAL(10, 2) DEFAULT 0,
    "netAmount" DECIMAL(10, 2),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    "failureReason" TEXT,
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT REFERENCES public."User"(id)
);

-- Platform Expenses (Master account expenses)
CREATE TABLE IF NOT EXISTS master."PlatformExpense" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "expenseNumber" TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    subcategory TEXT,
    vendor TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "receiptUrl" TEXT,
    
    -- Approval workflow
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    "approvedById" TEXT REFERENCES public."User"(id),
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    
    -- Metadata
    notes TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT REFERENCES public."User"(id)
);

-- Platform Settings (Master configuration)
CREATE TABLE IF NOT EXISTS master."PlatformSettings" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    "isSecret" BOOLEAN DEFAULT false,
    "isEditable" BOOLEAN DEFAULT true,
    "lastModifiedById" TEXT REFERENCES public."User"(id),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Billing Run History (Track monthly billing runs)
CREATE TABLE IF NOT EXISTS master."BillingRun" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingMonth" DATE NOT NULL,
    "organizationsProcessed" INTEGER NOT NULL DEFAULT 0,
    "invoicesGenerated" INTEGER NOT NULL DEFAULT 0,
    "totalBilled" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    errors JSONB DEFAULT '[]',
    summary JSONB DEFAULT '{}',
    "createdById" TEXT REFERENCES public."User"(id)
);

-- Commission Tracking (For sales/referrals)
CREATE TABLE IF NOT EXISTS master."Commission" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL REFERENCES public."User"(id),
    "organizationId" TEXT NOT NULL REFERENCES public."Organization"(id),
    "invoiceId" TEXT REFERENCES master."MasterInvoice"(id),
    "commissionType" TEXT NOT NULL CHECK ("commissionType" IN ('signup', 'monthly', 'upgrade', 'referral')),
    "baseAmount" DECIMAL(10, 2) NOT NULL,
    "commissionRate" DECIMAL(5, 2) NOT NULL,
    "commissionAmount" DECIMAL(10, 2) NOT NULL,
    "payoutStatus" TEXT NOT NULL DEFAULT 'pending' CHECK ("payoutStatus" IN ('pending', 'approved', 'paid', 'cancelled')),
    "payoutDate" TIMESTAMP(3),
    "payoutMethod" TEXT,
    "payoutReference" TEXT,
    notes TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "MasterInvoice_organizationId_idx" ON master."MasterInvoice"("organizationId");
CREATE INDEX IF NOT EXISTS "MasterInvoice_status_idx" ON master."MasterInvoice"(status);
CREATE INDEX IF NOT EXISTS "MasterInvoice_issueDate_idx" ON master."MasterInvoice"("issueDate");
CREATE INDEX IF NOT EXISTS "MasterInvoice_dueDate_idx" ON master."MasterInvoice"("dueDate");

CREATE INDEX IF NOT EXISTS "MasterPayment_invoiceId_idx" ON master."MasterPayment"("invoiceId");
CREATE INDEX IF NOT EXISTS "MasterPayment_organizationId_idx" ON master."MasterPayment"("organizationId");
CREATE INDEX IF NOT EXISTS "MasterPayment_status_idx" ON master."MasterPayment"(status);
CREATE INDEX IF NOT EXISTS "MasterPayment_paymentDate_idx" ON master."MasterPayment"("paymentDate");

CREATE INDEX IF NOT EXISTS "PlatformExpense_category_idx" ON master."PlatformExpense"(category);
CREATE INDEX IF NOT EXISTS "PlatformExpense_expenseDate_idx" ON master."PlatformExpense"("expenseDate");
CREATE INDEX IF NOT EXISTS "PlatformExpense_status_idx" ON master."PlatformExpense"(status);

CREATE INDEX IF NOT EXISTS "Commission_userId_idx" ON master."Commission"("userId");
CREATE INDEX IF NOT EXISTS "Commission_organizationId_idx" ON master."Commission"("organizationId");
CREATE INDEX IF NOT EXISTS "Commission_payoutStatus_idx" ON master."Commission"("payoutStatus");

-- Insert default platform settings
INSERT INTO master."PlatformSettings" (key, value, category, description, "isSecret", "isEditable") VALUES
('billing.tax_rate', '0.0', 'billing', 'Default tax rate for invoices', false, true),
('billing.payment_terms_days', '30', 'billing', 'Default payment terms in days', false, true),
('billing.late_fee_percentage', '1.5', 'billing', 'Monthly late fee percentage', false, true),
('billing.reminder_intervals', '[7, 14, 30]', 'billing', 'Days after due date to send reminders', false, true),
('commission.signup_rate', '0.20', 'commission', 'Commission rate for new signups', false, true),
('commission.monthly_rate', '0.10', 'commission', 'Commission rate for monthly renewals', false, true),
('platform.maintenance_mode', 'false', 'platform', 'Enable maintenance mode', false, true),
('platform.signup_enabled', 'true', 'platform', 'Allow new organization signups', false, true)
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA master TO podcastflow;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA master TO podcastflow;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA master TO podcastflow;

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION master.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_master_invoice_updated_at BEFORE UPDATE ON master."MasterInvoice"
    FOR EACH ROW EXECUTE FUNCTION master.update_updated_at_column();

CREATE TRIGGER update_master_payment_updated_at BEFORE UPDATE ON master."MasterPayment"
    FOR EACH ROW EXECUTE FUNCTION master.update_updated_at_column();

CREATE TRIGGER update_platform_expense_updated_at BEFORE UPDATE ON master."PlatformExpense"
    FOR EACH ROW EXECUTE FUNCTION master.update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON master."PlatformSettings"
    FOR EACH ROW EXECUTE FUNCTION master.update_updated_at_column();

CREATE TRIGGER update_commission_updated_at BEFORE UPDATE ON master."Commission"
    FOR EACH ROW EXECUTE FUNCTION master.update_updated_at_column();

-- Reset search path
SET search_path TO public;