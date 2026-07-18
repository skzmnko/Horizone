export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  USER_ALREADY_REGISTERED: 'user_already_registered',
  PASSWORD_TOO_SHORT: 'password_too_short',
  EMAIL_NOT_CONFIRMED: 'email_not_confirmed',
  DISPLAY_NAME_TAKEN: 'display_name_taken',
  GENERIC: 'generic',
  INVITE_EXPIRED: 'invite_expired',
  NETWORK_ERROR: 'network_error'
};

export const mapSupabaseErrorToCode = (supabaseMessage) => {
  const exactMap = {
    'Invalid login credentials': ERROR_CODES.INVALID_CREDENTIALS,
    'User already registered': ERROR_CODES.USER_ALREADY_REGISTERED,
    'Password should be at least 6 characters': ERROR_CODES.PASSWORD_TOO_SHORT,
    'Email not confirmed': ERROR_CODES.EMAIL_NOT_CONFIRMED,
    'A user with this email address has already been registered': ERROR_CODES.USER_ALREADY_REGISTERED,
    'Database error saving new user': ERROR_CODES.DISPLAY_NAME_TAKEN,
  };
  if (exactMap[supabaseMessage]) {
    return exactMap[supabaseMessage];
  }

  if (typeof supabaseMessage === 'string' &&
      (supabaseMessage.includes('duplicate key') || supabaseMessage.includes('profiles_display_name_key'))) {
    return ERROR_CODES.DISPLAY_NAME_TAKEN;
  }

  return ERROR_CODES.GENERIC;
};