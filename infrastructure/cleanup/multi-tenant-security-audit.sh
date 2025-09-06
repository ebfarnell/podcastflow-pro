#!/bin/bash

# Multi-Tenant Security Audit Script
# This script audits the PodcastFlow Pro codebase for tenant isolation issues

set -e

AUDIT_DATE=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="multi-tenant-audit-report-$AUDIT_DATE.md"
CODEBASE_DIR="/home/ec2-user/podcastflow-pro/src"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=== Multi-Tenant Security Audit ==="
echo "Date: $(date)"
echo "Codebase: $CODEBASE_DIR"
echo ""

# Initialize report
cat > $REPORT_FILE << EOF
# Multi-Tenant Security Audit Report

Generated: $(date)
Codebase: $CODEBASE_DIR

## Executive Summary

This report identifies potential multi-tenant security issues in the PodcastFlow Pro application.

## Critical Findings

EOF

# Track findings
CRITICAL_COUNT=0
WARNING_COUNT=0
INFO_COUNT=0

# Function to log findings
log_finding() {
    local SEVERITY=$1
    local CATEGORY=$2
    local DESCRIPTION=$3
    local FILE=$4
    local LINE=$5
    
    case $SEVERITY in
        "CRITICAL")
            echo -e "${RED}[🚨 CRITICAL]${NC} $CATEGORY: $DESCRIPTION"
            echo "  File: $FILE:$LINE"
            echo "### 🚨 CRITICAL: $CATEGORY" >> $REPORT_FILE
            ((CRITICAL_COUNT++))
            ;;
        "WARNING")
            echo -e "${YELLOW}[⚠️  WARNING]${NC} $CATEGORY: $DESCRIPTION"
            echo "  File: $FILE:$LINE"
            echo "### ⚠️  WARNING: $CATEGORY" >> $REPORT_FILE
            ((WARNING_COUNT++))
            ;;
        "INFO")
            echo -e "${BLUE}[ℹ️  INFO]${NC} $CATEGORY: $DESCRIPTION"
            echo "  File: $FILE:$LINE"
            echo "### ℹ️  INFO: $CATEGORY" >> $REPORT_FILE
            ((INFO_COUNT++))
            ;;
    esac
    
    echo "- **Description**: $DESCRIPTION" >> $REPORT_FILE
    echo "- **Location**: \`$FILE:$LINE\`" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
}

echo "## 1. Checking for Direct Database Queries Without Tenant Filtering"
echo "" >> $REPORT_FILE
echo "## 1. Direct Database Queries" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check for Prisma queries without organization filtering
echo -e "\n${BLUE}Checking for unscoped Prisma queries...${NC}"
grep -rn "prisma\..*\.\(find\|create\|update\|delete\|upsert\)" $CODEBASE_DIR --include="*.ts" --include="*.tsx" | while IFS=: read -r file line content; do
    # Check if the query includes organizationId
    if ! echo "$content" | grep -q "organizationId\|orgSlug\|getUserOrgSlug\|querySchema"; then
        # Check if it's a User or Organization table (public schema)
        if ! echo "$content" | grep -q "prisma\.user\|prisma\.organization\|prisma\.session"; then
            # Check surrounding lines for organization context
            context=$(sed -n "$((line-5)),$((line+5))p" "$file" 2>/dev/null)
            if ! echo "$context" | grep -q "organizationId\|orgSlug\|getUserOrgSlug\|querySchema"; then
                log_finding "WARNING" "Unscoped Database Query" "Prisma query without visible organization filtering" "$file" "$line"
            fi
        fi
    fi
done

echo "## 2. Checking for Cross-Tenant Data Access Patterns"
echo "" >> $REPORT_FILE
echo "## 2. Cross-Tenant Access Patterns" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check for queries that might access multiple organizations
echo -e "\n${BLUE}Checking for potential cross-tenant queries...${NC}"
grep -rn "findMany\|aggregate\|groupBy" $CODEBASE_DIR --include="*.ts" --include="*.tsx" | while IFS=: read -r file line content; do
    # Skip if it's in a master-only file
    if [[ "$file" == *"/master/"* ]] || [[ "$file" == *"master"* ]]; then
        continue
    fi
    
    # Check if query has proper where clause
    if ! echo "$content" | grep -q "where.*organizationId"; then
        log_finding "WARNING" "Potential Cross-Tenant Query" "Bulk query without visible organization filter" "$file" "$line"
    fi
done

echo "## 3. Checking API Routes for Tenant Validation"
echo "" >> $REPORT_FILE
echo "## 3. API Route Tenant Validation" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check API routes for proper tenant validation
echo -e "\n${BLUE}Checking API routes for tenant validation...${NC}"
find $CODEBASE_DIR/app/api -name "route.ts" -o -name "route.tsx" | while read -r file; do
    # Check if file has proper auth checks
    if ! grep -q "validateSession\|withApiProtection\|getUserOrgSlug" "$file"; then
        log_finding "CRITICAL" "Unprotected API Route" "API route without visible authentication" "$file" "1"
    fi
    
    # Check for organization context validation
    if grep -q "POST\|PUT\|DELETE" "$file"; then
        if ! grep -q "organizationId\|orgSlug\|getUserOrgSlug" "$file"; then
            log_finding "WARNING" "Missing Org Validation" "Mutation route without organization context check" "$file" "1"
        fi
    fi
done

echo "## 4. Checking for Shared State or Caching Issues"
echo "" >> $REPORT_FILE
echo "## 4. Shared State and Caching" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check for global variables that might leak data
echo -e "\n${BLUE}Checking for global state that could leak tenant data...${NC}"
grep -rn "global\|window\|cache\|static.*=.*{" $CODEBASE_DIR --include="*.ts" --include="*.tsx" | while IFS=: read -r file line content; do
    # Skip test files and type definitions
    if [[ "$file" == *".test."* ]] || [[ "$file" == *".d.ts" ]]; then
        continue
    fi
    
    # Check if it might store tenant-specific data
    if echo "$content" | grep -q "data\|user\|organization\|campaign\|show"; then
        log_finding "WARNING" "Potential Data Leakage" "Global state that might store tenant data" "$file" "$line"
    fi
done

echo "## 5. Checking Schema-Based Query Usage"
echo "" >> $REPORT_FILE
echo "## 5. Schema-Based Queries" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check for proper use of querySchema function
echo -e "\n${BLUE}Checking for schema-based query patterns...${NC}"
grep -rn "querySchema" $CODEBASE_DIR --include="*.ts" --include="*.tsx" | while IFS=: read -r file line content; do
    echo -e "${GREEN}[✅ GOOD]${NC} Schema-aware query found"
    echo "  File: $file:$line"
done

echo "## 6. Checking for SQL Injection Vulnerabilities"
echo "" >> $REPORT_FILE
echo "## 6. SQL Injection Risks" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check for raw SQL without parameterization
echo -e "\n${BLUE}Checking for SQL injection risks...${NC}"
grep -rn "\$raw\|prisma\.\$executeRaw\|queryRaw" $CODEBASE_DIR --include="*.ts" --include="*.tsx" | while IFS=: read -r file line content; do
    # Check if using template literals unsafely
    if echo "$content" | grep -q '${.*}\|" + .*\|" +'; then
        log_finding "CRITICAL" "SQL Injection Risk" "Raw SQL with string concatenation" "$file" "$line"
    fi
done

echo "## 7. Checking File Upload and Storage Isolation"
echo "" >> $REPORT_FILE
echo "## 7. File Storage Isolation" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check file upload handlers
echo -e "\n${BLUE}Checking file upload isolation...${NC}"
grep -rn "upload\|writeFile\|createWriteStream" $CODEBASE_DIR --include="*.ts" --include="*.tsx" | while IFS=: read -r file line content; do
    # Check if paths include organization context
    if ! echo "$content" | grep -q "organizationId\|orgSlug\|org_"; then
        log_finding "WARNING" "File Storage Risk" "File operation without organization path isolation" "$file" "$line"
    fi
done

echo "## 8. Checking for Proper Error Handling"
echo "" >> $REPORT_FILE
echo "## 8. Error Information Leakage" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Check for error messages that might leak information
echo -e "\n${BLUE}Checking for information leakage in errors...${NC}"
grep -rn "catch.*{\|error\.message\|console\.error" $CODEBASE_DIR --include="*.ts" --include="*.tsx" | while IFS=: read -r file line content; do
    # Check if error includes sensitive data
    context=$(sed -n "$((line)),$((line+5))p" "$file" 2>/dev/null)
    if echo "$context" | grep -q "organizationId\|email\|password\|token"; then
        log_finding "WARNING" "Information Leakage" "Error handling might expose sensitive data" "$file" "$line"
    fi
done

# Generate summary
echo -e "\n${BLUE}=== Audit Summary ===${NC}"
echo ""
echo -e "${RED}Critical Issues: $CRITICAL_COUNT${NC}"
echo -e "${YELLOW}Warnings: $WARNING_COUNT${NC}"
echo -e "${BLUE}Info: $INFO_COUNT${NC}"
echo ""

# Add summary to report
cat >> $REPORT_FILE << EOF

## Summary

- **Critical Issues**: $CRITICAL_COUNT
- **Warnings**: $WARNING_COUNT
- **Informational**: $INFO_COUNT

## Recommendations

1. **Immediate Actions**:
   - Fix all CRITICAL issues immediately
   - Review all WARNING issues within 48 hours
   - Implement querySchema() for all tenant data queries

2. **Best Practices**:
   - Always use \`getUserOrgSlug()\` for tenant context
   - Use \`querySchema()\` for all organization-specific queries
   - Never store tenant data in global variables
   - Include organizationId in all file paths

3. **Testing**:
   - Create multi-tenant integration tests
   - Test with multiple concurrent organizations
   - Verify data isolation in all CRUD operations

## Next Steps

1. Fix identified issues
2. Re-run audit after fixes
3. Implement automated tests
4. Add pre-commit hooks for tenant validation

EOF

echo "Report saved to: $REPORT_FILE"
echo ""
echo -e "${GREEN}Audit complete!${NC}"