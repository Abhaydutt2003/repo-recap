import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return <SignIn forceRedirectUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIREDCT_URL} />
}