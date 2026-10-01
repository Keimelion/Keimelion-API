export const USERNAME_MIN_LENGTH = 1
export const USERNAME_MAX_LENGTH = 100
export const USERNAME_REGEX = new RegExp(
  `^[\\p{L}\\p{N}_-]{${String(USERNAME_MIN_LENGTH)},${String(USERNAME_MAX_LENGTH)}}$`,
  'u',
)
export const MAX_PASSWORD_LENGTH = 72
