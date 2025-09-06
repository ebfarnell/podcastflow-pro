-- Add Contact table for managing multiple contacts per advertiser/agency
-- This will be added to each organization schema

DO $$
DECLARE
    org_schema text;
BEGIN
    -- Loop through all organization schemas
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Create Contact table in each org schema
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."Contact" (
                "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "advertiserId" text,
                "agencyId" text,
                "name" text NOT NULL,
                "title" text,
                "email" text NOT NULL,
                "phone" text,
                "userId" text, -- Links to User table if they have an account
                "isPrimary" boolean DEFAULT false,
                "isActive" boolean DEFAULT true,
                "inviteStatus" text DEFAULT ''pending'', -- pending, sent, accepted, expired
                "invitedAt" timestamp,
                "inviteToken" text,
                "organizationId" text NOT NULL,
                "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "createdBy" text,
                "updatedBy" text,
                CONSTRAINT "Contact_advertiserId_fkey" FOREIGN KEY ("advertiserId") 
                    REFERENCES %I."Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT "Contact_agencyId_fkey" FOREIGN KEY ("agencyId") 
                    REFERENCES %I."Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT "Contact_either_advertiser_or_agency" 
                    CHECK (
                        ("advertiserId" IS NOT NULL AND "agencyId" IS NULL) OR 
                        ("advertiserId" IS NULL AND "agencyId" IS NOT NULL)
                    )
            )', org_schema, org_schema, org_schema);

        -- Create indexes for better performance
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "%s_Contact_advertiserId_idx" ON %I."Contact"("advertiserId");
            CREATE INDEX IF NOT EXISTS "%s_Contact_agencyId_idx" ON %I."Contact"("agencyId");
            CREATE INDEX IF NOT EXISTS "%s_Contact_email_idx" ON %I."Contact"("email");
            CREATE INDEX IF NOT EXISTS "%s_Contact_userId_idx" ON %I."Contact"("userId");
            CREATE INDEX IF NOT EXISTS "%s_Contact_inviteToken_idx" ON %I."Contact"("inviteToken");
        ', org_schema, org_schema, org_schema, org_schema, org_schema, org_schema, org_schema, org_schema, org_schema, org_schema);

        RAISE NOTICE 'Created Contact table in schema %', org_schema;
    END LOOP;
END $$;

-- Add a function to check if an email has an existing user account
CREATE OR REPLACE FUNCTION check_user_exists(contact_email text)
RETURNS TABLE (
    user_id text,
    user_status text,
    user_role text,
    organization_id text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        CASE 
            WHEN u."isActive" = true THEN 'active'
            WHEN u."inviteToken" IS NOT NULL AND u."inviteAcceptedAt" IS NULL THEN 'invited'
            ELSE 'deactivated'
        END as user_status,
        u.role as user_role,
        u."organizationId" as organization_id
    FROM public."User" u
    WHERE LOWER(u.email) = LOWER(contact_email);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_user_exists(text) TO podcastflow;