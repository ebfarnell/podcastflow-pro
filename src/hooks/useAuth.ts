import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Auth } from 'aws-amplify'

interface UseAuthReturn {
  user: any | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, attributes?: any) => Promise<void>
  signOut: () => Promise<void>
  confirmSignUp: (email: string, code: string) => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuthState()
  }, [])

  const checkAuthState = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser()
      setUser(currentUser)
    } catch (error) {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async (email: string, password: string) => {
    try {
      const user = await Auth.signIn(email, password)
      setUser(user)
      await checkAuthState()
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const handleSignUp = async (email: string, password: string, attributes?: any) => {
    try {
      await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          ...attributes,
        },
      })
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  const handleSignOut = async () => {
    try {
      await Auth.signOut()
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  const handleConfirmSignUp = async (email: string, code: string) => {
    try {
      await Auth.confirmSignUp(email, code)
    } catch (error) {
      console.error('Confirm sign up error:', error)
      throw error
    }
  }

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    confirmSignUp: handleConfirmSignUp,
  }
}