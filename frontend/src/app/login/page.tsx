import { Suspense } from 'react'
import { AuthExperience, AuthExperienceFallback } from '@/components/auth/AuthExperience'

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthExperienceFallback mode="login" />}>
      <AuthExperience mode="login" />
    </Suspense>
  )
}
