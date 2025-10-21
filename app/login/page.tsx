"use client";

import React from 'react';
import AuthLayout from '@/components/features/auth/AuthLayout';
import LoginForm from '@/components/features/auth/LoginForm';
import SocialLogin from '@/components/features/auth/SocialLogin';

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    console.log('Google login clicked');
    // Simulate login
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.href = '/dashboard';
  };

  const handleEmailLogin = async (email: string, password: string) => {
    console.log('Email login:', email);
    // Simulate login
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.href = '/dashboard';
  };

  return (
    <AuthLayout 
      title="Welcome back"
      subtitle="Sign in to your account to continue"
    >
      <div className="space-y-6">
        <SocialLogin 
          onGoogleLogin={handleGoogleLogin}
          isLoading={false}
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
          isLoading={false}
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