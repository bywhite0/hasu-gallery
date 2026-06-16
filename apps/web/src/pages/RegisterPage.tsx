import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../store/auth';
import { AuthLayout } from '../components/AuthLayout';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      navigate({ to: '/gallery/meme' });
    }
  }, [user, navigate]);

  return (
    <AuthLayout title="Register">
      <RegisterForm />
    </AuthLayout>
  );
}
