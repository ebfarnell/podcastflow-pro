# Data Handling Guidelines

## Overview
PodcastFlow Pro is a production SaaS application that uses real data from PostgreSQL. Mock data is only available in development mode for testing purposes.

## Production Data Policy

### NEVER Use Mock Data in Production
- All data must come from the PostgreSQL database
- Use `safeQuerySchema` for all organization-specific queries
- Implement proper error handling and empty states
- Never hardcode sample data in production code

### Defensive Programming
```typescript
// Always use safeQuerySchema for org data
const { data, error } = await safeQuerySchema(orgSlug, query, params)
if (error) {
  console.error('Query failed:', error)
  return NextResponse.json([]) // Return empty data, not 500 error
}
```

## Development Mode

### Enabling Mock Data
Mock data can be enabled ONLY in development mode by setting the environment variable:
```bash
ENABLE_MOCK_DATA=true
```

### Using Mock Data in Development
```typescript
import { isMockDataEnabled } from '@/lib/utils/feature-flags'

// In your API route or component
if (isMockDataEnabled()) {
  // Return mock data for development
  return mockData
}

// Otherwise use real database
const realData = await fetchFromDatabase()
```

### Environment Configuration
1. Copy `.env.development.example` to `.env.development`
2. Set `ENABLE_MOCK_DATA=true` for development
3. Ensure `NODE_ENV=development`

## Empty States

### Always Implement Empty States
Every page and component should handle empty data gracefully:

```typescript
// Bad - crashes when no data
{data.map(item => <Item key={item.id} />)}

// Good - handles empty state
{data.length === 0 ? (
  <EmptyState message="No data available" />
) : (
  data.map(item => <Item key={item.id} />)
)}
```

### Empty State Components
```typescript
<Alert severity="info">
  <Typography variant="body2">
    No items found - Start by creating your first item
  </Typography>
</Alert>
```

## API Response Patterns

### Success with Empty Data
```typescript
// Return empty array, not error
return NextResponse.json([])

// Or with metadata
return NextResponse.json({
  items: [],
  total: 0,
  message: "No items found"
})
```

### Error Handling
```typescript
try {
  const data = await fetchData()
  return NextResponse.json(data)
} catch (error) {
  console.error('API Error:', error)
  // Return empty data with error flag
  return NextResponse.json({
    data: [],
    error: true,
    message: 'Unable to fetch data'
  })
}
```

## Database Queries

### Organization-Specific Data
Always use the organization schema:
```typescript
const orgSlug = await getUserOrgSlug(session.userId)
const { data, error } = await safeQuerySchema(
  orgSlug, 
  'SELECT * FROM "Show" WHERE active = true',
  []
)
```

### Public Schema Data
Only for platform-wide data:
```typescript
// Users, Organizations, Sessions only
const user = await prisma.user.findUnique({
  where: { id: userId }
})
```

## Testing Guidelines

### Local Development
1. Use real database with test data
2. Enable mock data only when needed
3. Test empty states thoroughly
4. Verify error handling

### Production Testing
1. Never enable mock data
2. Use test organizations
3. Create real test data
4. Monitor error logs

## Common Pitfalls to Avoid

1. **Hardcoded Arrays**: Never use hardcoded data arrays in production code
2. **Missing Empty States**: Always handle zero data scenarios
3. **500 Errors**: Return empty data instead of throwing errors
4. **Wrong Schema**: Use org schemas for business data, not public schema
5. **Assuming Data Exists**: Always check if data exists before using it

## Migration Checklist

When removing mock data from a component:
- [ ] Remove all hardcoded arrays
- [ ] Implement API data fetching
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add empty state UI
- [ ] Test with no data
- [ ] Test with errors
- [ ] Verify in production