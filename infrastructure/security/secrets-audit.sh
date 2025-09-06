#!/bin/bash

# Secrets and Credentials Audit Script
# This script searches for potential hardcoded secrets in the codebase

set -e

AUDIT_DATE=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="secrets-audit-report-$AUDIT_DATE.md"
CODEBASE_DIR="/home/ec2-user/podcastflow-pro"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== Secrets and Credentials Audit ==="
echo "Date: $(date)"
echo "Scanning: $CODEBASE_DIR"
echo ""

# Initialize report
cat > $REPORT_FILE << EOF
# Secrets and Credentials Audit Report

Generated: $(date)
Codebase: $CODEBASE_DIR

## Summary

This report identifies potential hardcoded secrets and credentials in the codebase.

## Findings

EOF

# Track findings
CRITICAL_COUNT=0
WARNING_COUNT=0

# Function to check file
check_file() {
    local file=$1
    local pattern=$2
    local description=$3
    local severity=$4
    
    if grep -n -i "$pattern" "$file" 2>/dev/null | head -5; then
        echo -e "${RED}[$severity]${NC} $description found in: $file"
        echo "### $severity: $description" >> $REPORT_FILE
        echo "File: \`$file\`" >> $REPORT_FILE
        echo "\`\`\`" >> $REPORT_FILE
        grep -n -i "$pattern" "$file" 2>/dev/null | head -5 >> $REPORT_FILE
        echo "\`\`\`" >> $REPORT_FILE
        echo "" >> $REPORT_FILE
        
        if [ "$severity" = "CRITICAL" ]; then
            ((CRITICAL_COUNT++))
        else
            ((WARNING_COUNT++))
        fi
    fi
}

# Patterns to search for
echo "Checking for hardcoded secrets..."
echo ""

# 1. Database credentials
echo -e "${YELLOW}Checking for database credentials...${NC}"
find $CODEBASE_DIR -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/dist/*" | while read file; do
    
    # PostgreSQL URLs
    if grep -E "postgresql://[^$]" "$file" 2>/dev/null | grep -v "process\.env" | grep -v "example"; then
        check_file "$file" "postgresql://[^$]" "Hardcoded PostgreSQL URL" "CRITICAL"
    fi
    
    # Database passwords
    if grep -E "(password|passwd|pwd)\s*[:=]\s*['\"][^'\"$]+['\"]" "$file" 2>/dev/null | \
       grep -v "process\.env" | grep -v "password123" | grep -v "example" | grep -v "placeholder"; then
        check_file "$file" "password\s*[:=]\s*['\"]" "Hardcoded password" "CRITICAL"
    fi
done

# 2. API Keys and Tokens
echo -e "\n${YELLOW}Checking for API keys and tokens...${NC}"
find $CODEBASE_DIR -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.env*" \) \
    -not -path "*/node_modules/*" -not -path "*/.next/*" -not -name "*.example" | while read file; do
    
    # API Keys
    if grep -E "(api_key|apikey|api-key)\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]" "$file" 2>/dev/null | \
       grep -v "process\.env" | grep -v "example"; then
        check_file "$file" "api_key\s*[:=]" "Hardcoded API key" "CRITICAL"
    fi
    
    # JWT Secrets
    if grep -E "(jwt_secret|jwtsecret|secret)\s*[:=]\s*['\"][^'\"$]+['\"]" "$file" 2>/dev/null | \
       grep -v "process\.env" | grep -v "example" | grep -v "test"; then
        check_file "$file" "jwt_secret\s*[:=]" "Hardcoded JWT secret" "CRITICAL"
    fi
    
    # AWS Keys
    if grep -E "AKIA[0-9A-Z]{16}" "$file" 2>/dev/null; then
        check_file "$file" "AKIA[0-9A-Z]{16}" "AWS Access Key" "CRITICAL"
    fi
done

# 3. Check .env files
echo -e "\n${YELLOW}Checking .env files...${NC}"
find $CODEBASE_DIR -name ".env*" -not -name "*.example" -not -path "*/node_modules/*" | while read file; do
    if [ -f "$file" ]; then
        echo -e "${YELLOW}[WARNING]${NC} Environment file found: $file"
        echo "### WARNING: Environment File" >> $REPORT_FILE
        echo "File: \`$file\`" >> $REPORT_FILE
        echo "Ensure this file is in .gitignore" >> $REPORT_FILE
        echo "" >> $REPORT_FILE
        ((WARNING_COUNT++))
    fi
done

# 4. Check for sensitive data in configs
echo -e "\n${YELLOW}Checking configuration files...${NC}"
find $CODEBASE_DIR -type f \( -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.config.js" \) \
    -not -path "*/node_modules/*" -not -path "*/.next/*" | while read file; do
    
    # Connection strings
    if grep -E "(mongodb|mysql|postgres|redis)://[^$]" "$file" 2>/dev/null | grep -v "localhost" | grep -v "example"; then
        check_file "$file" "://[^$]" "Connection string in config" "WARNING"
    fi
done

# 5. Check for private keys
echo -e "\n${YELLOW}Checking for private keys...${NC}"
find $CODEBASE_DIR -type f \( -name "*.pem" -o -name "*.key" -o -name "*.p12" \) \
    -not -path "*/node_modules/*" | while read file; do
    echo -e "${RED}[CRITICAL]${NC} Private key file found: $file"
    echo "### CRITICAL: Private Key File" >> $REPORT_FILE
    echo "File: \`$file\`" >> $REPORT_FILE
    echo "Private keys should not be in the repository" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    ((CRITICAL_COUNT++))
done

# 6. Check current environment
echo -e "\n${YELLOW}Checking current environment configuration...${NC}"
if [ -f "$CODEBASE_DIR/.env" ]; then
    echo "### Current .env Variables" >> $REPORT_FILE
    echo "The following environment variables are defined:" >> $REPORT_FILE
    echo "\`\`\`" >> $REPORT_FILE
    grep -E "^[A-Z_]+="  "$CODEBASE_DIR/.env" | cut -d'=' -f1 >> $REPORT_FILE
    echo "\`\`\`" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
fi

# Summary
echo -e "\n${GREEN}=== Audit Summary ===${NC}"
echo "Critical Issues: $CRITICAL_COUNT"
echo "Warnings: $WARNING_COUNT"
echo ""

# Add summary to report
cat >> $REPORT_FILE << EOF

## Statistics

- **Critical Issues**: $CRITICAL_COUNT
- **Warnings**: $WARNING_COUNT

## Recommendations

1. Move all hardcoded credentials to environment variables
2. Use AWS Secrets Manager for production secrets
3. Add all .env files to .gitignore
4. Remove any private key files from the repository
5. Implement secret rotation policies

## Next Steps

1. Fix all CRITICAL issues immediately
2. Review WARNING issues
3. Implement secrets management system
4. Set up secret rotation

EOF

echo "Report saved to: $REPORT_FILE"
echo -e "${GREEN}Audit complete!${NC}"