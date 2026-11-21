import { Suspense } from 'react'
import { AuthExperience, AuthExperienceFallback } from '@/components/auth/AuthExperience'

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthExperienceFallback mode="signup" />}>
      <AuthExperience mode="signup" />
    </Suspense>
  )
}
