export type PlatformRole = 
  | 'CUSTOMER' 
  | 'GARAGE_OWNER' 
  | 'GARAGE_MANAGER' 
  | 'GARAGE_STAFF' 
  | 'ADVISOR' 
  | 'SUPER_ADMIN';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  roles: string[];
  permissions: string[];
  customerId?: string | null;
  garageId?: string | null;
  garageRole?: string | null;
  isActive: boolean;
  createdAtUtc?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: UserDto;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}
