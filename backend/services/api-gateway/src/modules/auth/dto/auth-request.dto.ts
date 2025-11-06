/**
 * Google OAuth DTO
 */
export class GoogleOAuthDto {
  code!: string;
}

/**
 * Refresh Token DTO
 */
export class RefreshTokenDto {
  refreshToken!: string;
}

/**
 * Logout DTO
 */
export class LogoutDto {
  userId!: string;
}
