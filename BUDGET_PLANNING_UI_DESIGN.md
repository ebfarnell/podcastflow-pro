# Budget Planning UI/UX Design Specification

## Overview
Modern, granular budget management interface supporting hierarchical view with Advertiser/Agency/Seller relationships, monthly granularity, rollup calculations, and historical comparisons.

## Core UI Components

### 1. Budget Planning Header
- **Year Selector**: Dropdown for budget year selection (2024-2027)
- **View Toggle**: Switch between "Hierarchy View" and "Flat View"
- **Time Period**: Month selector with "All Months" option
- **Comparison Toggle**: Enable/disable previous year comparison
- **Actions Bar**: Bulk edit, export, save changes, cancel

### 2. Seller Summary Cards (Top Row)
Grid of cards showing rollup data for each seller:

```
┌─────────────────────────────────────┐
│ John Seller                      ▲  │ <- Green arrow if on target
│ Total Budget: $150,000              │
│ Total Actual: $140,000              │  
│ Variance: -$10,000 (-6.7%)      🔴 │ <- Red circle if off target
│ vs Last Year: +16.7%               │
│ Entities: 8 Advertisers, 3 Agencies │
└─────────────────────────────────────┘
```

### 3. Hierarchical Budget Grid

#### Grid Structure
```
Seller Name ▼
├── Agency Name ▼ 
│   ├── Advertiser A
│   ├── Advertiser B
│   └── [Agency Direct]
├── Advertiser C (Direct)
└── Advertiser D (Direct)
```

#### Column Layout (Responsive)
| Entity | Type | Jan | Feb | Mar | ... | Dec | Total | PY Actual | Variance | Actions |
|--------|------|-----|-----|-----|-----|-----|-------|-----------|----------|---------|
| 📊 John Seller | Seller | 50K | 55K | ... | ... | 600K | 520K | +80K | ... |
| └── 🏢 Big Agency | Agency | 30K | 35K | ... | ... | 360K | 300K | +60K | 📝 |
| &nbsp;&nbsp;&nbsp;&nbsp;└── Acme Corp | Advertiser | 20K | 25K | ... | ... | 240K | 200K | +40K | 📝 |
| &nbsp;&nbsp;&nbsp;&nbsp;└── Beta Inc | Advertiser | 10K | 10K | ... | ... | 120K | 100K | +20K | 📝 |
| └── 📢 Direct Advertiser | Advertiser | 20K | 20K | ... | ... | 240K | 220K | +20K | 📝 |

#### Visual Indicators
- **Hierarchy Indentation**: Clear visual nesting with connecting lines
- **Entity Type Icons**: 📊 Seller, 🏢 Agency, 📢 Advertiser  
- **Status Colors**: 
  - Green: On target (within 10% of budget)
  - Yellow: Caution (10-20% variance)
  - Red: Off target (>20% variance)
- **Expandable Rows**: Click to expand/collapse hierarchy levels

### 4. Inline Editing Experience

#### Edit Mode Toggle
- **View Mode**: Read-only with hover highlights
- **Edit Mode**: Monthly cells become editable inputs
- **Bulk Edit**: Select multiple cells for batch updates

#### Cell Editing
```
┌─────────────────┐
│ Budget: $25,000 │ <- Click to edit
│ Actual: $23,500 │ <- Editable if actual data entry allowed
│ ▲ +15% vs PY    │ <- Calculated comparison
└─────────────────┘
```

#### Save/Cancel Actions
- **Auto-save**: Debounced saves after 2 seconds of inactivity
- **Validation**: Real-time validation with error highlights
- **Batch Save**: "Save All Changes" button for explicit confirmation
- **Cancel**: "Cancel Changes" reverts unsaved modifications

### 5. Comparison View Features

#### Previous Year Toggle
When enabled, shows additional columns:
| Entity | Current Budget | Current Actual | PY Actual | YoY Growth | Variance |

#### Comparison Highlights
- **Growth Indicators**: ▲ Green arrow for positive growth, ▼ Red for negative
- **Percentage Colors**: Green >10%, Yellow 0-10%, Red <0%
- **Trend Visualization**: Mini sparkline charts for monthly trends

### 6. Rollup & Reconciliation

#### Automatic Rollups
- **Real-time Updates**: Rollup calculations update as values change
- **Visual Aggregation**: Parent rows show sum of children
- **Mismatch Indicators**: Highlight discrepancies between direct budgets and rollups

#### Reconciliation Panel
```
┌─────────────────────────────────────┐
│ Budget Reconciliation               │
│                                     │
│ John Seller Target: $150,000        │
│ ├── Direct Budget: $30,000          │
│ ├── Agency Rollup: $90,000          │ 
│ ├── Advertiser Rollup: $40,000     │
│ └── Total: $160,000                 │
│                                     │
│ ⚠️ Overage: $10,000                 │
│ [Adjust] [View Details]             │
└─────────────────────────────────────┘
```

### 7. Filtering & Search

#### Filter Panel (Collapsible Sidebar)
- **Seller Filter**: Multi-select checkbox list
- **Entity Type**: Advertiser, Agency, Seller checkboxes
- **Status Filter**: On Target, Off Target, No Data
- **Budget Range**: Min/Max sliders
- **Time Period**: Quick filters (Q1, Q2, H1, etc.)

#### Search Bar
- **Global Search**: Search across entity names
- **Smart Suggestions**: Autocomplete with recent searches
- **Filter Chips**: Applied filters shown as removable chips

### 8. Action Buttons & Workflows

#### Primary Actions
- **Add Budget**: Modal dialog for new budget entries
- **Bulk Import**: CSV/Excel import with template download
- **Export Data**: PDF, Excel, CSV options
- **Print View**: Printer-friendly layout

#### Secondary Actions
- **Assign Sellers**: Bulk reassignment workflow
- **Copy Previous Year**: Template creation from historical data
- **Forecast Models**: AI-assisted budget recommendations

### 9. Responsive Design

#### Desktop (>1200px)
- Full grid with all columns visible
- Sidebar filters panel
- Detailed rollup cards

#### Tablet (768px-1200px)  
- Scrollable horizontal grid
- Collapsible filter panel
- Compressed rollup cards

#### Mobile (<768px)
- Stacked card layout
- Swipe navigation between months
- Bottom sheet for editing
- Simplified hierarchy with drill-down

### 10. Error Handling & Validation

#### Real-time Validation
- **Budget Limits**: Prevent negative values
- **Rollup Consistency**: Warn when totals don't match
- **Data Conflicts**: Highlight simultaneous edits

#### Error States
```
┌─────────────────────────────────────┐
│ ⚠️ Budget Validation Errors         │
│                                     │
│ • Acme Corp Jan budget exceeds      │
│   seller allocation by $5,000      │
│ • Beta Inc missing Q2 data          │
│ • Big Agency rollup mismatch        │
│                                     │
│ [Fix Errors] [Save Anyway]          │
└─────────────────────────────────────┘
```

### 11. Performance Optimizations

#### Virtual Scrolling
- Render only visible rows in large datasets
- Smooth scrolling with buffer zones
- Lazy loading for expanded hierarchy

#### Data Loading
- Progressive loading with skeleton screens  
- Optimistic updates for better UX
- Background refresh with conflict resolution

#### Caching Strategy
- Client-side caching of rollup calculations
- Incremental updates for changed data only
- Service worker for offline capability

## Technical Implementation

### Component Architecture
```typescript
<BudgetPlanningPage>
  <BudgetHeader />
  <SellerSummaryCards />
  <BudgetFilters />
  <HierarchicalBudgetGrid>
    <BudgetRow />
    <EditableMonthCell />
    <RollupRow />
  </HierarchicalBudgetGrid>
  <BudgetActions />
  <ReconciliationPanel />
</BudgetPlanningPage>
```

### State Management
- **Zustand Store**: Budget data, UI state, edit mode
- **React Query**: Server state, caching, optimistic updates
- **Form State**: react-hook-form for complex validation

### Data Grid Library
- **TanStack Table**: Virtual scrolling, column management
- **Material-UI DataGrid**: Alternative with built-in editing
- **Custom Solution**: Full control over hierarchy rendering

This design provides a comprehensive, user-friendly interface for granular budget management while maintaining performance and usability across all device types.