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

// Сообщения ниже — это стабильные, документированные строки, которые
// Supabase Auth (GoTrue) возвращает НАПРЯМУЮ для конкретных, понятных
// ему самому ситуаций (неверный пароль, дубль email и т.д.) — их текст
// не зависит от наших триггеров, и сопоставлять его по подстроке безопасно.
//
// ВАЖНО: этого нельзя сказать про ошибки, возникающие ВНУТРИ наших
// собственных Postgres-триггеров (например, в handle_new_user при
// создании профиля) — GoTrue намеренно скрывает их настоящую причину
// от клиента и всегда возвращает один и тот же обобщённый текст
// ("Database error saving new user"), из соображений безопасности не
// раскрывая имена констрейнтов/таблиц. Различить ТАКИЕ ошибки по
// тексту невозможно в принципе — нужна отдельная, авторитетная проверка
// через собственный RPC. Именно поэтому здесь такой записи больше нет:
// AuthService.signUp() сам перепроверяет самого вероятного кандидата
// (занятость display_name) до того, как обратиться к этой функции —
// см. комментарий там.
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

  // Сопоставляем без учёта регистра/лишних пробелов и по вхождению
  // подстроки, а не точному равенству всей строки — так сопоставление
  // переживёт мелкие изменения формулировки на стороне Supabase
  // (лишний пробел, изменённая пунктуация и т.п.), а не ломается молча.
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
