"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import AuthLayout from '@/components/features/auth/AuthLayout';
import LoginForm from '@/components/features/auth/LoginForm';
import SocialLogin from '@/components/features/auth/SocialLogin';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`
        }
      });

      if (error) {
        throw error;
      }
      
      // The redirect will happen automatically
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        toast.success('Successfully signed in!');
        router.push('/dashboard');
      }
    } catch (error) {
        console.error('Email login error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Invalid email or password';
        toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Welcome back"
      subtitle="Sign in to your account to continue"
    >
      <div className="space-y-6">
        <SocialLogin 
          onGoogleLogin={handleGoogleLogin}
          isLoading={isLoading}
        />
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
              Or continue with
            </span>
          </div>
        </div>
        
        <LoginForm 
          onSubmit={handleEmailLogin}
          isLoading={isLoading}
        />
        
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}