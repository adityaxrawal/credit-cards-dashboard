/**
 * Auth Response DTO
 */
export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    email: string;
    name: string;
    profilePicture?: string;
    monthlyBudget?: number;
  };
}

/**
 * User Response DTO
 */
export class UserResponseDto {
  id!: string;
  email!: string;
  name!: string;
  profilePicture?: string;
  monthlyBudget?: number;
  createdAt?: string;
}

/**
 * Token Response DTO
 */
export class TokenResponseDto {
  accessToken!: string;
}
