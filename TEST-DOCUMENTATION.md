# Multi-Tenant Testing Suite Documentation

## Overview
Comprehensive testing suite for PodcastFlow Pro's multi-tenant data isolation system. This suite ensures complete data separation between organizations and validates security measures.

## Test Categories

### 1. Comprehensive Integration Tests (`multi-tenant-tests.js`)
**Primary Test Suite** - Complete end-to-end validation of multi-tenant isolation.

**Tests Included:**
- ✅ Organization schemas exist
- ✅ All required tables exist in each schema
- ✅ Data isolation works (insert/query separation)
- ✅ API isolation works (users only see their org data)
- ✅ Export functionality works
- ✅ Master account aggregation works
- ✅ Schema creation function works
- ✅ Cross-schema protection works

**Usage:**
```bash
# Run the comprehensive test suite
./run-multi-tenant-tests.sh

# Or run directly
node multi-tenant-tests.js
```

### 2. Unit Tests (`tests/unit/`)
Tests individual components and utilities.

**Files:**
- `schema-db.test.js` - Tests schema utility functions

**Tests:**
- Schema name generation from organization slugs
- SQL injection prevention in schema names
- Schema validation and sanitization
- Edge case handling

### 3. Integration Tests (`tests/integration/`)
Tests API endpoints and multi-tenant behavior.

**Files:**
- `multi-tenant-api.test.js` - Tests API isolation

**Tests:**
- Campaign API isolation between organizations
- Shows/Advertisers API isolation
- Cross-organization access prevention
- Export API authorization
- Master account aggregation access
- Authentication and authorization

### 4. Security Tests (`tests/security/`)
Tests security aspects and attack prevention.

**Files:**
- `data-isolation.test.js` - Tests data isolation security

**Tests:**
- Schema isolation validation
- Cross-schema access prevention
- Data containment verification
- Schema structure consistency
- Permission and access control
- SQL injection prevention

## Test Configuration

### Database Configuration
- **Host:** localhost
- **Database:** podcastflow_production
- **User:** podcastflow
- **Password:** PodcastFlow2025Prod

### Test Organizations
1. **PodcastFlow Pro** (`podcastflow-pro`)
   - Test User: admin@podcastflow.pro / admin123
   - Schema: `org_podcastflow_pro`

2. **Unfy** (`unfy`)
   - Test User: michael@unfy.com / EMunfy2025
   - Schema: `org_unfy`
   - Role: Master account

### Application Requirements
- Application must be running on localhost:3000
- PostgreSQL must be accessible
- Multi-tenant schemas must be created

## Running Tests

### Prerequisites
```bash
# Ensure application is running
pm2 status podcastflow-pro

# Install test dependencies
npm install --save-dev @jest/globals jest supertest node-fetch pg

# Or copy from package.test.json
cp package.test.json package-test.json
npm install --prefix . --package-lock-only
```

### Run All Tests
```bash
# Comprehensive test suite (recommended)
./run-multi-tenant-tests.sh

# Individual test categories
npm run test:unit
npm run test:integration  
npm run test:security

# All Jest tests
npm run test:all
```

### Continuous Testing
```bash
# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Results and Reports

### Test Report Generation
The test runner automatically generates:
- `multi-tenant-test-report.md` - Detailed test results
- Console output with colored status indicators
- Coverage reports (if using Jest with coverage)

### Success Criteria
All tests must pass for the system to be considered ready for production:

✅ **Schema Isolation**: Each organization has separate database schema  
✅ **Data Isolation**: Organizations cannot access each other's data  
✅ **API Security**: API endpoints respect organization boundaries  
✅ **Export Security**: Users can only export their organization's data  
✅ **Master Aggregation**: Master account can access cross-org analytics  
✅ **Schema Creation**: New organizations get complete schema setup  
✅ **Injection Prevention**: SQL injection attempts are blocked  

### Failure Handling
If any tests fail:
1. Review error messages in console output
2. Check `multi-tenant-test-report.md` for details
3. Verify database schema setup
4. Ensure application is running correctly
5. Check user permissions and credentials

## Security Validations

### Data Isolation Tests
- Insert test data into each organization schema
- Verify data exists only in correct schema
- Confirm data not visible to other organizations
- Test foreign key constraints within schemas

### API Security Tests
- Authenticate users for each organization
- Verify users only see their organization's data
- Test cross-organization access attempts (should fail)
- Validate export permissions

### SQL Injection Prevention
- Test malicious organization slug inputs
- Verify schema name sanitization
- Confirm parameterized queries prevent injection
- Test dangerous SQL operation blocking

## Troubleshooting

### Common Issues

**Application Not Running**
```bash
pm2 restart podcastflow-pro
pm2 logs podcastflow-pro
```

**Database Connection Failed**
```bash
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "SELECT 1;"
```

**Schemas Missing**
```bash
# Run migration
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -f multi-tenant-complete-migration.sql
```

**Test Dependencies Missing**
```bash
npm install node-fetch pg
```

### Debug Mode
Enable verbose logging by setting environment variable:
```bash
DEBUG=true node multi-tenant-tests.js
```

## Maintenance

### Adding New Tests
1. Create test file in appropriate directory
2. Follow existing test patterns
3. Use global test helpers from `tests/setup.js`
4. Update this documentation

### Updating Test Data
- Modify `TEST_CONFIG` in test files
- Update organization list if needed
- Adjust test user credentials as required

### Performance Considerations
- Tests use real database connections
- Large datasets may slow tests
- Consider test data cleanup between runs

## Production Readiness

This test suite validates that the multi-tenant system is ready for commercial use by ensuring:

🔒 **Complete Data Isolation** - No cross-organization data access  
🛡️ **Security Controls** - SQL injection and unauthorized access prevention  
📊 **Functional Integrity** - All APIs work correctly with isolation  
🔧 **Operational Readiness** - Export, backup, and management features work  
👑 **Master Account Controls** - Administrative features function properly  

When all tests pass, the system provides enterprise-grade data isolation suitable for commercial SaaS deployment.