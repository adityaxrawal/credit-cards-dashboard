/**
 * User Context Provider
 * Minimal user context for client components
 * Server components should fetch directly from API
 */

"use client";

import React, { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * Minimal user interface for client-side context
 */
export interface User {
  id: string;
  email: string;
  name: string;
  gmailConnected: boolean;
  isAdmin?: boolean;
  profilePicture?: string;
  monthlyBudget?: number;
}

/**
 * User context interface
 */
interface UserContextType {
  user: User | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * User Context Provider
 * Provides minimal user data to client components
 *
 * @example
 * // In server component (layout):
 * const user = await fetchUserFromAPI();
 * return <UserProvider user={user}>{children}</UserProvider>
 *
 * // In client component:
 * const { user } = useUser();
 */
export function UserProvider({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  return (
    <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>
  );
}

/**
 * Hook to access user context
 * @throws Error if used outside UserProvider
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error("useUser must be used within UserProvider");
  }

  return context;
}

/**
 * Hook to get authenticated user
 * @throws Error if user is not authenticated
 */
export function useAuthenticatedUser(): User {
  const { user } = useUser();

  if (!user) {
    throw new Error("User is not authenticated");
  }

  return user;
}

/**
 * Validate that data belongs to current user
 * Defensive check to prevent client-side data leaks
 */
export function validateUserOwnership(
  currentUserId: string,
  dataUserId: string | undefined,
  dataType: string = "data"
): void {
  if (!dataUserId) {
    // If no userId in data, we can't validate - log warning
    console.warn(`No userId found in ${dataType} - cannot validate ownership`);
    return;
  }

  if (dataUserId !== currentUserId) {
    console.error(
      `User ownership validation failed: ${dataType} belongs to ${dataUserId}, current user is ${currentUserId}`
    );
    throw new Error(`Access denied: This ${dataType} does not belong to you`);
  }
}

/**
 * Validate array of data items belong to current user
 */
export function validateArrayOwnership<T extends { userId?: string }>(
  currentUserId: string,
  dataArray: T[],
  dataType: string = "items"
): void {
  dataArray.forEach((item, index) => {
    if (item.userId && item.userId !== currentUserId) {
      throw new Error(
        `Access denied: ${dataType}[${index}] does not belong to you`
      );
    }
  });
}
