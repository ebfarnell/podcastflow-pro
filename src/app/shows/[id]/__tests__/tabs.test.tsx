import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import ShowDetailPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock contexts
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: '1', email: 'admin@test.com', role: 'admin' }
  }))
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: jest.fn(() => ({
    currentOrganization: { id: 'org1', domain: 'test-org' }
  }))
}))

jest.mock('@/contexts/AudioContext', () => ({
  useAudio: jest.fn(() => ({ play: jest.fn() }))
}))

// Mock API services
jest.mock('@/services/api', () => ({
  showsApi: {
    get: jest.fn(() => Promise.resolve({
      showId: 'show1',
      name: 'Test Show',
      description: 'Test Description',
      host: 'Test Host',
      category: 'Test Category',
      status: 'active',
      totalEpisodes: 10,
      socialMedia: {}
    }))
  },
  episodesApi: {
    list: jest.fn(() => Promise.resolve({ episodes: [] }))
  },
  campaignApi: {
    list: jest.fn(() => Promise.resolve({ campaigns: [] }))
  }
}))

describe('Show Tabs Navigation', () => {
  let mockRouter: any
  let mockSearchParams: any
  let queryClient: QueryClient

  beforeEach(() => {
    // Setup mocks
    mockRouter = { push: jest.fn() }
    mockSearchParams = new URLSearchParams()
    
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useParams as jest.Mock).mockReturnValue({ id: 'show1' })
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    })

    // Mock window.history
    Object.defineProperty(window, 'history', {
      value: {
        pushState: jest.fn()
      },
      writable: true
    })
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  test('renders all tabs for admin user', async () => {
    renderWithProviders(<ShowDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Episodes')).toBeInTheDocument()
      expect(screen.getByText('Campaigns')).toBeInTheDocument()
      expect(screen.getByText('Revenue Projections')).toBeInTheDocument()
      expect(screen.getByText('Rate History')).toBeInTheDocument()
      expect(screen.getByText('Category Exclusivity')).toBeInTheDocument()
      expect(screen.getByText('Rate Analytics')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  test('hides restricted tabs for non-admin users', async () => {
    // Mock as client user
    jest.mock('@/contexts/AuthContext', () => ({
      useAuth: jest.fn(() => ({
        user: { id: '1', email: 'client@test.com', role: 'client' }
      }))
    }))

    renderWithProviders(<ShowDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Episodes')).toBeInTheDocument()
      expect(screen.getByText('Campaigns')).toBeInTheDocument()
      expect(screen.getByText('Revenue Projections')).toBeInTheDocument()
      expect(screen.queryByText('Rate History')).not.toBeInTheDocument()
      expect(screen.queryByText('Category Exclusivity')).not.toBeInTheDocument()
      expect(screen.queryByText('Rate Analytics')).not.toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  test('updates URL when tab is clicked', async () => {
    renderWithProviders(<ShowDetailPage />)

    await waitFor(() => {
      const campaignsTab = screen.getByText('Campaigns')
      fireEvent.click(campaignsTab)
    })

    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      '',
      expect.stringContaining('tab=campaigns')
    )
  })

  test('saves tab selection to localStorage', async () => {
    renderWithProviders(<ShowDetailPage />)

    await waitFor(() => {
      const settingsTab = screen.getByText('Settings')
      fireEvent.click(settingsTab)
    })

    expect(window.localStorage.setItem).toHaveBeenCalledWith('showTab', 'settings')
  })

  test('initializes from URL parameter', async () => {
    mockSearchParams.set('tab', 'rateHistory')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    renderWithProviders(<ShowDetailPage />)

    await waitFor(() => {
      // Check that Rate History content would be shown (tab is selected)
      expect(screen.getByRole('tabpanel', { name: /rate history/i })).toHaveAttribute('hidden', 'false')
    })
  })

  test('initializes from localStorage when no URL param', async () => {
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue('settings')

    renderWithProviders(<ShowDetailPage />)

    await waitFor(() => {
      // Check that Settings content would be shown (tab is selected)
      expect(screen.getByRole('tabpanel', { name: /settings/i })).toHaveAttribute('hidden', 'false')
    })
  })

  test('Settings tab shows correct content', async () => {
    renderWithProviders(<ShowDetailPage />)

    await waitFor(() => {
      const settingsTab = screen.getByText('Settings')
      fireEvent.click(settingsTab)
    })

    // Check for Settings-specific content
    expect(screen.getByLabelText('Show Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Twitter')).toBeInTheDocument()
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })
})