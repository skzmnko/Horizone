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

// The messages below are stable, documented strings that Supabase Auth (GoTrue)
// returns DIRECTLY for specific, well-understood scenarios (incorrect password,
// duplicate email, etc.) — their text is independent of our triggers, so
// substring matching against them is safe.
//
// IMPORTANT: the same does NOT apply to errors arising INSIDE our own Postgres
// triggers (e.g., in handle_new_user during profile creation) — GoTrue
// intentionally obscures their root cause from the client and always returns
// the same generic text ("Database error saving new user"), for security
// reasons, without exposing constraint/table names. Distinguishing SUCH errors
// by text alone is fundamentally impossible — a separate, authoritative
// verification via our own RPC endpoint is required. This is precisely why such
// a case is no longer mapped here: AuthService.signUp() itself re-verifies the
// most likely culprit (display_name already taken) before even calling this
// function — see the comment there.
const KNOWN_MESSAGES = [
  { code: ERROR_CODES.INVALID_CREDENTIALS, match: 'invalid login credentials' },
  { code: ERROR_CODES.USER_ALREADY_REGISTERED, match: 'user already registered' },
  { code: ERROR_CODES.USER_ALREADY_REGISTERED, match: 'already been registered' },
  { code: ERROR_CODES.PASSWORD_TOO_SHORT, match: 'password should be at least 6 characters' },
  { code: ERROR_CODES.EMAIL_NOT_CONFIRMED, match: 'email not confirmed' },
];

export const mapSupabaseErrorToCode = (supabaseMessage) => {
  if (typeof supabaseMessage !== 'string' || !supabaseMessage.trim()) {
    return ERROR_CODES.GENERIC;
  }

  const normalized = supabaseMessage.trim().toLowerCase();

  const found = KNOWN_MESSAGES.find(({ match }) => normalized.includes(match));
  if (found) {
    return found.code;
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return ERROR_CODES.NETWORK_ERROR;
  }

  return ERROR_CODES.GENERIC;
};
