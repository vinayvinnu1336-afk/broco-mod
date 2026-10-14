// Password rules, kept in step with the API (PasswordPolicy.cs).
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters`;
export const PASSWORD_TOO_SHORT = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
