/** 认证上下文（middleware 注入） */
export interface AuthContext {
  userId: string;
  email?: string;
  nickname?: string;
  avatar?: string;
  authProvider?: string;
  status: string;
}

/** 游客上下文 */
export interface GuestContext {
  guestSessionId: string;
}

/** 请求认证信息 */
export type RequestAuth = 
  | { type: 'user'; user: AuthContext }
  | { type: 'guest'; guest: GuestContext }
  | { type: 'anonymous' };

/** Google OAuth token 响应 */
export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

/** Google id_token 解码 */
export interface GoogleIdToken {
  iss: string;
  sub: string;           // Google 用户唯一 ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

/** Session JWT payload */
export interface SessionPayload {
  sub: string;    // userId
  jti: string;    // sessionId
  iat?: number;
  exp?: number;
}