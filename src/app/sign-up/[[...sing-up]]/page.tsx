import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return <SignUp forceRedirectUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIREDCT_URL}/>
}