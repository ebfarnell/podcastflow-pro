import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material'
import {
  PlayArrow,
  Settings,
  AutoMode,
  Warning,
  CheckCircle,
  Schedule,
  Description,
  Assignment,
  AttachMoney
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface AutomationRule {
  id: string
  name: string
  trigger: {
    entityType: string
    fromState?: string
    toState: string
    conditions?: any[]
  }
  actions: Array<{
    type: 'create_contract' | 'create_ad_request' | 'send_notification' | 'update_status' | 'assign_task'
    config: any
  }>
  isActive: boolean
}

const actionTypeIcons = {
  create_contract: <Description />,
  create_ad_request: <Assignment />,
  create_invoice: <AttachMoney />,
  create_order: <Assignment />,
  send_notification: <Schedule />,
  update_status: <CheckCircle />,
  assign_task: <Settings />
}

const actionTypeLabels = {
  create_contract: 'Create Contract',
  create_ad_request: 'Create Ad Request',
  create_invoice: 'Create Invoice',
  create_order: 'Create Order',
  send_notification: 'Send Notification',
  update_status: 'Update Status',
  assign_task: 'Assign Task'
}

const entityTypeColors = {
  order: 'primary',
  campaign: 'secondary',
  contract: 'success',
  approval: 'warning',
  episode: 'info'
} as const

export default function WorkflowAutomationsSection() {
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null)
  const [testData, setTestData] = useState({
    entityId: '',
    entityType: 'order',
    previousState: '',
    newState: '',
    metadata: '{}'
  })

  const queryClient = useQueryClient()

  // Fetch automation rules
  const { data: rulesData, isLoading, error } = useQuery({
    queryKey: ['workflow-automations'],
    queryFn: async () => {
      const response = await fetch('/api/workflow/automations', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch automation rules')
      }
      
      return response.json()
    }
  })

  // Toggle rule status mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string, isActive: boolean }) => {
      const response = await fetch('/api/workflow/automations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'toggle',
          ruleId,
          isActive: !isActive // Toggle the current state
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to toggle automation rule')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-automations'] })
    }
  })

  // Test automation mutation
  const testAutomationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/workflow/automations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'trigger',
          ruleId: selectedRule?.id,
          ...data,
          metadata: data.metadata ? JSON.parse(data.metadata) : {}
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to execute automation')
      }
      
      return response.json()
    },
    onSuccess: () => {
      setTestDialogOpen(false)
      setTestData({
        entityId: '',
        entityType: 'order',
        previousState: '',
        newState: '',
        metadata: '{}'
      })
    }
  })

  const rules = rulesData?.rules || []

  const handleToggleRule = (rule: AutomationRule) => {
    toggleRuleMutation.mutate({
      ruleId: rule.id,
      isActive: rule.isActive
    })
  }

  const handleTestAutomation = (rule: AutomationRule) => {
    setSelectedRule(rule)
    setTestData({
      ...testData,
      entityType: rule.trigger.entityType,
      previousState: rule.trigger.fromState || '',
      newState: rule.trigger.toState
    })
    setTestDialogOpen(true)
  }

  const executeTest = () => {
    if (!selectedRule) return
    testAutomationMutation.mutate(testData)
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load workflow automations. Please check your permissions.
      </Alert>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Workflow Automations
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Configure automated actions when orders, campaigns, and contracts change status.
        </Typography>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Automation Rules */}
      <Stack spacing={2}>
        {rules.map((rule: AutomationRule) => (
          <Card key={rule.id} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {rule.name}
                  </Typography>
                  
                  {/* Trigger Info */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Trigger:
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={rule.trigger.entityType}
                        color={entityTypeColors[rule.trigger.entityType as keyof typeof entityTypeColors] || 'default'}
                        size="small"
                      />
                      {rule.trigger.fromState && (
                        <>
                          <Typography variant="body2">from</Typography>
                          <Chip label={rule.trigger.fromState} variant="outlined" size="small" />
                        </>
                      )}
                      <Typography variant="body2">to</Typography>
                      <Chip label={rule.trigger.toState} variant="outlined" size="small" />
                    </Stack>
                  </Box>

                  {/* Actions */}
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Actions ({rule.actions.length}):
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                      {rule.actions.map((action, index) => (
                        <Chip
                          key={index}
                          icon={actionTypeIcons[action.type]}
                          label={actionTypeLabels[action.type]}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                </Box>

                <Box sx={{ ml: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rule.isActive}
                        onChange={() => handleToggleRule(rule)}
                        disabled={toggleRuleMutation.isPending}
                      />
                    }
                    label={rule.isActive ? 'Active' : 'Inactive'}
                  />
                </Box>
              </Box>
            </CardContent>
            
            <CardActions>
              <Button
                size="small"
                startIcon={<PlayArrow />}
                onClick={() => handleTestAutomation(rule)}
                disabled={!rule.isActive}
              >
                Test Rule
              </Button>
              <Button
                size="small"
                startIcon={<Settings />}
                disabled
              >
                Configure
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>

      {/* Test Automation Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Test Automation Rule: {selectedRule?.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Entity ID"
              value={testData.entityId}
              onChange={(e) => setTestData({ ...testData, entityId: e.target.value })}
              placeholder="Enter the ID of the entity to test with"
              fullWidth
              required
            />
            
            <TextField
              label="Entity Type"
              value={testData.entityType}
              onChange={(e) => setTestData({ ...testData, entityType: e.target.value })}
              fullWidth
              disabled
            />
            
            <TextField
              label="Previous State"
              value={testData.previousState}
              onChange={(e) => setTestData({ ...testData, previousState: e.target.value })}
              placeholder="Optional: previous state"
              fullWidth
            />
            
            <TextField
              label="New State"
              value={testData.newState}
              onChange={(e) => setTestData({ ...testData, newState: e.target.value })}
              fullWidth
              required
            />
            
            <TextField
              label="Metadata (JSON)"
              value={testData.metadata}
              onChange={(e) => setTestData({ ...testData, metadata: e.target.value })}
              multiline
              rows={3}
              placeholder="{}"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={executeTest}
            variant="contained"
            disabled={testAutomationMutation.isPending || !testData.entityId || !testData.newState}
            startIcon={testAutomationMutation.isPending ? <LinearProgress /> : <PlayArrow />}
          >
            Execute Test
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Messages */}
      {toggleRuleMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to update automation rule
        </Alert>
      )}
      
      {testAutomationMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to execute automation test
        </Alert>
      )}
      
      {testAutomationMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Automation test executed successfully
        </Alert>
      )}
    </Box>
  )
}