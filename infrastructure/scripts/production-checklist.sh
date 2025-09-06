#!/bin/bash

# Production Deployment Checklist
# Run this script before deploying to production

set -e

echo "🔍 PodcastFlow Pro - Production Readiness Checklist"
echo "=================================================="

ERRORS=0
WARNINGS=0

# Function to report errors
error() {
    echo "❌ ERROR: $1"
    ((ERRORS++))
}

# Function to report warnings
warning() {
    echo "⚠️  WARNING: $1"
    ((WARNINGS++))
}

# Function to report success
success() {
    echo "✅ $1"
}

# Check for hardcoded credentials
echo -e "\n1. Checking for hardcoded credentials..."
if grep -r "Michael@unfy.com\|EMunfy2025\|admin@podcastflowpro.com\|Lq4lEzcwOddn84OLMUVlLvKzu" ../../src ../../infrastructure --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null; then
    error "Found hardcoded credentials in source files"
else
    success "No hardcoded credentials found"
fi

# Check for console.log statements
echo -e "\n2. Checking for console.log statements..."
LOG_COUNT=$(grep -r "console\.log" ../../src --exclude-dir=node_modules --exclude="*.test.*" --exclude="*.spec.*" | wc -l)
if [ $LOG_COUNT -gt 0 ]; then
    warning "Found $LOG_COUNT console.log statements in source files"
else
    success "No console.log statements found"
fi

# Check for localhost URLs
echo -e "\n3. Checking for localhost URLs..."
if grep -r "localhost:" ../../src --exclude-dir=node_modules --exclude="*.env*" --exclude="*.example" 2>/dev/null; then
    warning "Found localhost URLs in source files"
else
    success "No localhost URLs found"
fi

# Check for TODO comments
echo -e "\n4. Checking for TODO comments..."
TODO_COUNT=$(grep -r "TODO\|FIXME\|XXX" ../../src ../../infrastructure/lambdas --exclude-dir=node_modules | wc -l)
if [ $TODO_COUNT -gt 0 ]; then
    warning "Found $TODO_COUNT TODO/FIXME comments"
else
    success "No TODO comments found"
fi

# Check environment files
echo -e "\n5. Checking environment configuration..."
if [ -f "../../.env.local" ]; then
    if grep -q "Michael@unfy.com\|EMunfy2025" "../../.env.local"; then
        error ".env.local contains hardcoded credentials"
    else
        success ".env.local exists and no credentials found"
    fi
else
    warning ".env.local not found"
fi

if [ -f "../../.env.production" ]; then
    success ".env.production exists"
else
    error ".env.production not found"
fi

# Check for debug pages
echo -e "\n6. Checking for debug pages..."
if [ -d "../../src/app/debug-auth" ] || [ -d "../../src/app/test" ]; then
    warning "Debug/test pages still exist in source"
else
    success "No debug pages found"
fi

# Check Lambda CORS configuration
echo -e "\n7. Checking Lambda CORS configuration..."
CORS_WILDCARD=$(grep -r "Access-Control-Allow-Origin.*\*" ../lambdas --exclude-dir=node_modules --exclude="*.sh" | wc -l)
if [ $CORS_WILDCARD -gt 0 ]; then
    error "Found $CORS_WILDCARD Lambda functions with wildcard CORS (*)"
else
    success "No wildcard CORS configurations found"
fi

# Check for API authentication
echo -e "\n8. Checking API Gateway authentication..."
if grep -q "AuthorizationType: NONE" ../cloudformation/*.yaml 2>/dev/null; then
    error "Found API endpoints without authentication"
else
    success "All API endpoints have authentication"
fi

# Check AWS SDK versions
echo -e "\n9. Checking AWS SDK versions..."
SDK_V2=$(find ../lambdas -name "package.json" -exec grep -l '"aws-sdk"' {} \; | wc -l)
if [ $SDK_V2 -gt 0 ]; then
    warning "Found $SDK_V2 Lambda functions using AWS SDK v2 (consider upgrading to v3)"
else
    success "All Lambda functions use AWS SDK v3"
fi

# Check for secrets in CloudFormation
echo -e "\n10. Checking CloudFormation templates..."
if grep -q "TempPass\|password\|Password" ../cloudformation/*.yaml 2>/dev/null | grep -v "PasswordPolicy\|PasswordLength"; then
    error "Found potential passwords in CloudFormation templates"
else
    success "No passwords found in CloudFormation templates"
fi

# Summary
echo -e "\n=================================================="
echo "SUMMARY:"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ $ERRORS -gt 0 ]; then
    echo -e "\n❌ FAILED: Fix all errors before deploying to production!"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "\n⚠️  PASSED WITH WARNINGS: Consider addressing warnings before production deployment."
    exit 0
else
    echo -e "\n✅ PASSED: Application is ready for production deployment!"
    exit 0
fi