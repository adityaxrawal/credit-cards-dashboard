/**
 * Auth Module Interfaces
 */

export interface IUser {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  monthlyBudget?: number;
  createdAt?: string;
  isActive?: boolean;
  googleId?: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface IGoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface ISessionData {
  accessToken: string;
  refreshToken: string;
  createdAt: string;
  lastRefreshed?: string;
}
