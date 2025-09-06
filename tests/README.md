# PodcastFlow Pro API Testing Suite

## Overview
Comprehensive testing suite for all PodcastFlow Pro API endpoints, covering authentication, campaigns, billing, real-time analytics, and master administration.

## Test Structure

### Test Files
- `tests/api/auth.test.ts` - Authentication endpoints
- `tests/api/campaigns.test.ts` - Campaign management APIs
- `tests/api/billing.test.ts` - Invoice and payment processing
- `tests/api/real-time-analytics.test.ts` - Real-time analytics pipeline
- `tests/api/master.test.ts` - Master administration endpoints

### Helper Files
- `tests/helpers/test-utils.ts` - Test utilities and database helpers
- `tests/setup.ts` - Global test setup and teardown

## Prerequisites

### Database Setup
1. PostgreSQL must be running on localhost:5432
2. Test database: `podcastflow_test`
3. Database user: `podcastflow` with password `PodcastFlow2025Prod`

### Environment Variables
```bash
NODE_ENV=test
TEST_DATABASE_URL=postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_test
NEXTAUTH_SECRET=test-secret-key-for-testing-only
```

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm run test:all
# or
npm test
```

### Run Specific Test Suites
```bash
# Authentication tests
npm run test:auth

# Campaign management tests
npm run test:campaigns

# Billing and invoice tests
npm run test:billing

# Real-time analytics tests
npm run test:analytics

# Master admin tests
npm run test:master
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Using Test Runner Script
```bash
# Run all tests
./scripts/run-tests.sh

# Run specific suite
./scripts/run-tests.sh auth
./scripts/run-tests.sh campaigns
./scripts/run-tests.sh billing
./scripts/run-tests.sh analytics
./scripts/run-tests.sh master

# Run with coverage
./scripts/run-tests.sh coverage

# Watch mode
./scripts/run-tests.sh watch
```

## Test Coverage

### Authentication (`auth.test.ts`)
- ✅ Login with valid credentials
- ✅ Reject invalid credentials
- ✅ Validate required fields
- ✅ Handle non-existent users
- ✅ Block inactive users
- ✅ Logout functionality
- ✅ Session management

### Campaign Management (`campaigns.test.ts`)
- ✅ List campaigns with organization isolation
- ✅ Create new campaigns with validation
- ✅ Get individual campaign details
- ✅ Update campaign information
- ✅ Delete campaigns
- ✅ Campaign analytics endpoints
- ✅ Pagination and search
- ✅ Permission enforcement

### Billing System (`billing.test.ts`)
- ✅ Campaign billing information retrieval
- ✅ Payment processing with invoice generation
- ✅ Campaign invoice creation
- ✅ Monthly recurring billing (master)
- ✅ Commission tracking and management
- ✅ Bulk payment operations
- ✅ Financial metrics calculation
- ✅ Master-only endpoint protection

### Real-Time Analytics (`real-time-analytics.test.ts`)
- ✅ Event ingestion (single and batch)
- ✅ Pipeline status monitoring
- ✅ Campaign-specific metrics
- ✅ Real-time dashboard data
- ✅ WebSocket subscriptions (SSE)
- ✅ Analytics simulation
- ✅ User journey tracking
- ✅ Event validation and error handling

### Master Administration (`master.test.ts`)
- ✅ Platform analytics overview
- ✅ Billing and revenue reporting
- ✅ Organization management
- ✅ Cross-organization user management
- ✅ Platform settings configuration
- ✅ Master role enforcement
- ✅ Data aggregation and filtering

## Test Utilities

### Test User Creation
```typescript
const testUser = await createTestUser({
  email: 'test@example.com',
  role: 'admin',
  organizationId: 'optional-org-id'
})
```

### Test Session Management
```typescript
const sessionToken = await createTestSession(testUser.id)
```

### Test Campaign Creation
```typescript
const testCampaign = await createTestCampaign({
  organizationId: testUser.organizationId,
  name: 'Test Campaign',
  budget: 5000
})
```

### Authenticated Requests
```typescript
const request = createAuthenticatedRequest(
  '/api/campaigns',
  'GET',
  null, // body
  sessionToken
)
```

### Response Validation
```typescript
// Success response
assertApiResponse(data, ['campaigns', 'total', 'timestamp'])

// Error response
assertErrorResponse(data, 400)
```

### Data Cleanup
```typescript
// Clean up all test data for an organization
await cleanupTestData(organizationId)
```

## Database Testing Strategy

### Test Isolation
- Each test uses a separate organization to prevent data conflicts
- Automatic cleanup after each test
- Fresh database state for each test run

### Data Management
- Real database connections (not mocked)
- Actual Prisma operations
- Foreign key constraint validation
- Transaction rollback on errors

### Performance
- Tests run sequentially (`maxWorkers: 1`) to avoid conflicts
- Efficient cleanup with cascading deletes
- Optimized test data generation

## Security Testing

### Authentication
- Valid/invalid credentials
- Session management
- Token expiration
- Role-based access control

### Authorization
- Organization data isolation
- Role permission enforcement
- Master-only endpoint protection
- Cross-tenant data access prevention

### Input Validation
- Required field validation
- Data type checking
- Business logic constraints
- SQL injection prevention

## Error Handling

### Expected Errors
- 400 Bad Request - Invalid input data
- 401 Unauthorized - Missing/invalid authentication
- 403 Forbidden - Insufficient permissions
- 404 Not Found - Resource does not exist
- 500 Internal Server Error - Server-side errors

### Error Response Format
```typescript
{
  error: string,
  timestamp?: string,
  details?: any
}
```

## Performance Testing

### Response Times
- API endpoints should respond within 2 seconds
- Database queries optimized for test environment
- Bulk operations validated for efficiency

### Load Testing
- Real-time analytics event ingestion
- Bulk payment processing
- Large dataset handling

## Continuous Integration

### GitHub Actions Integration
```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: PodcastFlow2025Prod
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:all
```

### Pre-commit Hooks
```bash
# Run tests before commit
npm run test:all && npm run typecheck
```

## Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Test Database Setup
```bash
# Create test database manually
PGPASSWORD=PodcastFlow2025Prod createdb -h localhost -U podcastflow podcastflow_test

# Reset test database
DATABASE_URL=$TEST_DATABASE_URL npx prisma db push --force-reset
```

#### TypeScript Errors
```bash
# Generate Prisma client
npx prisma generate

# Type check
npm run typecheck
```

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test

# Jest verbose mode
npm test -- --verbose

# Single test file
npm test -- tests/api/auth.test.ts
```

## Coverage Requirements

### Minimum Coverage Thresholds
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### Coverage Reports
- Text output in terminal
- HTML report in `coverage/` directory
- LCOV format for CI integration

## Best Practices

### Test Organization
- One test file per API module
- Descriptive test names
- Proper setup/teardown
- Isolated test data

### Test Data
- Use realistic test data
- Avoid hardcoded IDs
- Clean up after each test
- Test edge cases

### Assertions
- Test both success and failure cases
- Validate response structure
- Check business logic constraints
- Verify database state changes

### Performance
- Minimize test execution time
- Use efficient data generation
- Parallel execution where safe
- Monitor test performance

## Future Enhancements

### Planned Additions
- End-to-end testing with Playwright
- Load testing with Artillery
- API contract testing
- Visual regression testing
- Integration with monitoring

### Test Environment Improvements
- Docker containerization
- Test data factories
- Snapshot testing
- Mutation testing
- Property-based testing