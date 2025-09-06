#!/bin/bash

# PodcastFlow Pro API Test Runner
echo "🧪 Starting PodcastFlow Pro API Tests..."

# Set environment variables
export NODE_ENV=test
export TEST_DATABASE_URL="postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_test"
export NEXTAUTH_SECRET="test-secret-key-for-testing-only"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up test environment...${NC}"

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running. Please start PostgreSQL first.${NC}"
    exit 1
fi

# Create test database if it doesn't exist
echo -e "${BLUE}📊 Creating test database...${NC}"
PGPASSWORD=PodcastFlow2025Prod createdb -h localhost -U podcastflow podcastflow_test 2>/dev/null || echo "Test database already exists"

# Run database migrations for test environment
echo -e "${BLUE}🗃️ Running database migrations...${NC}"
DATABASE_URL=$TEST_DATABASE_URL npx prisma db push --force-reset

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Database setup failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Test environment setup complete${NC}"

# Run tests based on parameters
if [ "$1" = "auth" ]; then
    echo -e "${YELLOW}🔐 Running authentication tests...${NC}"
    npm test -- tests/api/auth.test.ts
elif [ "$1" = "campaigns" ]; then
    echo -e "${YELLOW}📊 Running campaign tests...${NC}"
    npm test -- tests/api/campaigns.test.ts
elif [ "$1" = "billing" ]; then
    echo -e "${YELLOW}💰 Running billing tests...${NC}"
    npm test -- tests/api/billing.test.ts
elif [ "$1" = "analytics" ]; then
    echo -e "${YELLOW}📈 Running real-time analytics tests...${NC}"
    npm test -- tests/api/real-time-analytics.test.ts
elif [ "$1" = "master" ]; then
    echo -e "${YELLOW}👑 Running master API tests...${NC}"
    npm test -- tests/api/master.test.ts
elif [ "$1" = "rates" ]; then
    echo -e "${YELLOW}💵 Running rate management tests...${NC}"
    npm test -- tests/api/rate-management.test.js
elif [ "$1" = "contracts" ]; then
    echo -e "${YELLOW}📄 Running contract & billing workflow tests...${NC}"
    npm test -- tests/contract-billing-workflows.test.js
elif [ "$1" = "e2e" ]; then
    echo -e "${YELLOW}🔄 Running end-to-end contract-to-payment tests...${NC}"
    npm test -- tests/e2e/contract-to-payment.test.js
elif [ "$1" = "budget" ]; then
    echo -e "${YELLOW}💼 Running budget management tests...${NC}"
    npm test -- tests/budget/hierarchical-budget.test.js
elif [ "$1" = "coverage" ]; then
    echo -e "${YELLOW}📊 Running all tests with coverage...${NC}"
    npm test -- --coverage
elif [ "$1" = "watch" ]; then
    echo -e "${YELLOW}👀 Running tests in watch mode...${NC}"
    npm test -- --watch
else
    echo -e "${YELLOW}🚀 Running all API tests...${NC}"
    npm test
fi

# Capture test exit code
TEST_EXIT_CODE=$?

# Cleanup
echo -e "${BLUE}🧹 Cleaning up test environment...${NC}"
DATABASE_URL=$TEST_DATABASE_URL npx prisma db push --force-reset > /dev/null 2>&1

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed${NC}"
fi

exit $TEST_EXIT_CODE