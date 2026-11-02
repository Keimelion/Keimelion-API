export const AUTH_PROVIDER_VALUES = ['email', 'google'] as const
export type AuthProvider = (typeof AUTH_PROVIDER_VALUES)[number]
