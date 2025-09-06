# Currency Formatting Guide

## Important: Always Use Centralized Formatters

To ensure all dollar amounts display with proper formatting (exactly 2 decimal places), you **MUST** use the centralized formatting utilities.

## ✅ DO Use These Functions:

```typescript
import { formatCurrency, formatDollars } from '@/lib/utils'

// For any dollar amount:
formatCurrency(1234.5)      // Returns: "$1,234.50"
formatDollars(1234)         // Returns: "$1,234.00"
formatCurrency(1234.567)    // Returns: "$1,234.57" (rounds properly)
```

## ❌ DON'T Use These Patterns:

```typescript
// WRONG - Don't use toFixed() directly:
`$${amount.toFixed(2)}`

// WRONG - Don't use toLocaleString without proper options:
amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// WRONG - Don't use template literals:
`$${amount}`
```

## Available Formatters:

### Currency Formatting
```typescript
import { formatCurrency, formatCompactCurrency, formatLargeCurrency } from '@/lib/utils'

// Standard currency (always 2 decimals):
formatCurrency(1234.5)           // "$1,234.50"

// Compact currency (no decimals for whole numbers):
formatCompactCurrency(1234)      // "$1,234"
formatCompactCurrency(1234.5)    // "$1,234.50"

// Large amounts with abbreviations:
formatLargeCurrency(1500000)     // "$1.50M"
formatLargeCurrency(2500000000)  // "$2.50B"
```

### Other Formatters
```typescript
import { formatPercentage, formatNumber, formatDate } from '@/lib/utils'

// Percentages:
formatPercentage(45.567)         // "45.57%"
formatPercentage(45.567, 1)      // "45.6%"

// Numbers with commas:
formatNumber(1234567)            // "1,234,567"
formatNumber(1234.567, 2)        // "1,234.57"

// Dates:
formatDate('2025-08-04')         // "Aug 4, 2025"
formatDateTime('2025-08-04')     // "Aug 4, 2025, 3:45 PM"
```

## Migration Checklist

When updating existing code:

1. Search for: `toFixed(2)` and replace with `formatCurrency()`
2. Search for: `toLocaleString` with currency and replace with `formatCurrency()`
3. Search for: `$${` patterns and replace with proper formatters

## Examples in Components:

```tsx
// In a table cell:
<TableCell>{formatCurrency(campaign.budget)}</TableCell>

// In a card:
<Typography variant="h4">
  {formatCurrency(totalRevenue)}
</Typography>

// In an input field:
<TextField
  value={formatCurrency(amount)}
  onChange={(e) => setAmount(parseCurrency(e.target.value))}
/>
```

## Why This Matters

- **Consistency**: All currency displays exactly 2 decimal places
- **Localization**: Proper thousand separators and currency symbols
- **Rounding**: Proper rounding rules applied consistently
- **Maintenance**: Single place to update formatting rules
- **Professional**: Consistent formatting looks more polished

Remember: Every dollar amount shown to users should go through `formatCurrency()` or `formatDollars()`!