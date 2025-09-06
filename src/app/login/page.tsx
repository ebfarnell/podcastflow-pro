'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

type TestAccount = {
  email: string
  password: string
  role: string
  name: string
}

const testAccounts: TestAccount[] = [
  { email: 'admin@podcastflow.pro', password: 'admin123', role: 'Admin', name: 'Admin User' },
  { email: 'seller@podcastflow.pro', password: 'seller123', role: 'Sales', name: 'Sales Representative' },
  { email: 'producer@podcastflow.pro', password: 'producer123', role: 'Producer', name: 'Show Producer' },
  { email: 'talent@podcastflow.pro', password: 'talent123', role: 'Talent', name: 'Podcast Host' },
  { email: 'client@podcastflow.pro', password: 'client123', role: 'Client', name: 'Client User' },
]

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    setIsLoading(true)

    try {
      await login(data.email, data.password)
      // The login function handles redirection based on role
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestAccountLogin = (account: TestAccount) => {
    setValue('email', account.email)
    setValue('password', account.password)
    handleSubmit(onSubmit)()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 pt-1">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <img
              className="h-[399px] w-auto max-w-full"
              src="/images/logos/logo-main-cropped.png"
              alt="PodcastFlow Pro"
            />
          </div>
          <h2 className="-mt-[72px] text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-4 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && <Alert variant="destructive">{error}</Alert>}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <Input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="Email address"
                error={errors.email?.message}
              />
            </div>
            <div className="mt-4">
              <Input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                error={errors.password?.message}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              Sign in
            </Button>
          </div>
        </form>

        {/* Test Account Section */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                Test Accounts
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {testAccounts.slice(0, -1).map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleTestAccountLogin(account)}
                  className="group relative rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {account.role[0]}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{account.role}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{account.name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {testAccounts.length % 2 === 1 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => handleTestAccountLogin(testAccounts[testAccounts.length - 1])}
                  className="group relative rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-[calc(50%-0.375rem)]"
                  disabled={isLoading}
                >
                  <div className="flex items-center justify-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {testAccounts[testAccounts.length - 1].role[0]}
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{testAccounts[testAccounts.length - 1].role}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{testAccounts[testAccounts.length - 1].name}</p>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Click any test account to auto-fill credentials
          </p>
        </div>
      </div>
    </div>
  )
}