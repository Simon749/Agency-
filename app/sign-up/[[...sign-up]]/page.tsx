import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: '#0b0b0b' }}>
      <SignUp routing="hash" signInUrl="/sign-in" />
    </div>
  );
}