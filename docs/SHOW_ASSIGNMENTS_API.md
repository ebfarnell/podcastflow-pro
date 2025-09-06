# Show Assignments API Documentation

## Overview

The Show Assignments API allows you to manage user assignments (producers and talent) to shows in a multi-tenant environment. All assignments are organization-specific and fully isolated.

## Authentication

All endpoints require authentication via the `auth-token` cookie. Only users with `admin` or `master` roles can manage assignments.

## Endpoints

### 1. Get Show Assignments

Retrieve all user assignments for a specific show.

```
GET /api/shows/{showId}/assignments
```

**Response:**
```json
{
  "showId": "show123",
  "showName": "Morning Talk Show",
  "assignments": [
    {
      "userId": "user456",
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "https://...",
      "userRole": "producer",         // User's system role
      "assignmentRole": "producer",   // Role in this show (optional)
      "assignedAt": "2025-07-28T10:00:00Z",
      "assignedBy": "admin123",
      "assignedByName": "Admin User"
    },
    {
      "userId": "user789",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "avatar": null,
      "userRole": "talent",
      "assignmentRole": "talent",
      "assignedAt": "2025-07-27T14:30:00Z",
      "assignedBy": "admin123",
      "assignedByName": "Admin User"
    }
  ]
}
```

### 2. Assign User to Show

Assign a user to a show with an optional role override.

```
POST /api/shows/{showId}/assignments
```

**Request Body:**
```json
{
  "userId": "user456",
  "role": "producer"  // Optional - defaults to user's system role
}
```

**Response:**
```json
{
  "success": true,
  "message": "User John Doe assigned to show Morning Talk Show",
  "assignment": {
    "showId": "show123",
    "userId": "user456",
    "role": "producer",
    "assignedAt": "2025-07-28T12:00:00Z",
    "assignedBy": "admin123"
  }
}
```

### 3. Remove User from Show

Remove a user assignment from a show.

```
DELETE /api/shows/{showId}/assignments/{userId}
```

**Response:**
```json
{
  "success": true,
  "message": "User John Doe removed from show Morning Talk Show"
}
```

## Frontend Implementation Examples

### React/TypeScript Example

```typescript
import { showsApi } from '@/services/api'

// Get show assignments
async function getShowAssignments(showId: string) {
  try {
    const response = await fetch(`/api/shows/${showId}/assignments`, {
      credentials: 'include' // Important for cookie auth
    })
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch assignments:', error)
  }
}

// Assign user to show
async function assignUserToShow(showId: string, userId: string, role?: string) {
  try {
    const response = await fetch(`/api/shows/${showId}/assignments`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, role })
    })
    return await response.json()
  } catch (error) {
    console.error('Failed to assign user:', error)
  }
}

// Remove user from show
async function removeUserFromShow(showId: string, userId: string) {
  try {
    const response = await fetch(`/api/shows/${showId}/assignments/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    return await response.json()
  } catch (error) {
    console.error('Failed to remove user:', error)
  }
}
```

### React Component Example

```tsx
import React, { useState, useEffect } from 'react'
import { Button, List, ListItem, Autocomplete } from '@mui/material'

function ShowAssignments({ showId }: { showId: string }) {
  const [assignments, setAssignments] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  
  useEffect(() => {
    fetchAssignments()
    fetchAvailableUsers()
  }, [showId])
  
  const fetchAssignments = async () => {
    const data = await getShowAssignments(showId)
    setAssignments(data.assignments || [])
  }
  
  const fetchAvailableUsers = async () => {
    // Fetch users who can be assigned (producers/talent)
    const response = await fetch('/api/users?role=producer,talent', {
      credentials: 'include'
    })
    const data = await response.json()
    setUsers(data.users || [])
  }
  
  const handleAssign = async () => {
    if (!selectedUser) return
    
    await assignUserToShow(showId, selectedUser.id, selectedUser.role)
    await fetchAssignments() // Refresh list
    setSelectedUser(null)
  }
  
  const handleRemove = async (userId: string) => {
    if (confirm('Remove this user from the show?')) {
      await removeUserFromShow(showId, userId)
      await fetchAssignments() // Refresh list
    }
  }
  
  return (
    <div>
      <h3>Show Assignments</h3>
      
      {/* Current assignments */}
      <List>
        {assignments.map(assignment => (
          <ListItem key={assignment.userId}>
            <span>{assignment.name} ({assignment.userRole})</span>
            <Button onClick={() => handleRemove(assignment.userId)}>
              Remove
            </Button>
          </ListItem>
        ))}
      </List>
      
      {/* Add new assignment */}
      <Autocomplete
        options={users}
        getOptionLabel={(user) => `${user.name} (${user.role})`}
        value={selectedUser}
        onChange={(event, newValue) => setSelectedUser(newValue)}
        renderInput={(params) => (
          <TextField {...params} label="Select User to Assign" />
        )}
      />
      <Button 
        onClick={handleAssign} 
        disabled={!selectedUser}
        variant="contained"
      >
        Assign to Show
      </Button>
    </div>
  )
}
```

## Data Isolation

- All assignments are scoped to the user's organization
- Users can only be assigned within their own organization
- Cross-organization assignments are not possible
- The `_ShowToUser` table exists in each organization's schema

## Error Handling

Common error responses:

- `401`: Authentication required or session expired
- `403`: Insufficient permissions (not admin/master)
- `404`: Show or user not found
- `400`: Invalid request (missing userId, etc)
- `500`: Server error

## Notes

- When a user is deleted, their assignments are automatically removed (CASCADE)
- When a show is deleted, all assignments are automatically removed (CASCADE)
- The assignment role is optional and defaults to the user's system role
- Assignment history is tracked with `assignedAt` and `assignedBy` fields