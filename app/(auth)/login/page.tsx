import { Button } from '@/components/ui/button'
import { FcGoogle } from 'react-icons/fc'
import { signInWithGoogle } from './actions'

export default async function LoginPage() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
      <form action={signInWithGoogle}>
        <Button variant="outline" className="flex items-center gap-2">
          <FcGoogle />
          <span>Sign in with Google</span>
        </Button>
      </form>
    </div>
  )
}