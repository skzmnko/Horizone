export default {
  common: {
    appName: 'Trace & Place',
    subtitle: 'Интерактивные карты',
    back: 'Назад',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
  },
  login: {
    title: 'Trace & Place',
    subtitle: 'Интерактивные карты',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Пароль',
    passwordPlaceholder: 'Пароль',
    loginButton: 'Войдите в мир',
    registerButton: 'Зарегистрироваться',
    resetButton: 'Отправить письмо',
    displayNameLabel: 'Имя пользователя',
    displayNamePlaceholder: 'Придумай имя пользователя',
    passwordConfirmLabel: 'Повтори пароль',
    passwordConfirmPlaceholder: 'Ещё раз',
    switchToRegister: 'Нет аккаунта? Зарегистрироваться',
    switchToLogin: 'Уже есть аккаунт? Войти',
    switchToLoginFromReset: 'Вспомнили пароль? Войти',
    switchToReset: 'Забыли пароль?',
    checkEmailTitle: 'Проверь почту',
    continueToLogin: 'Перейти ко входу',

    // Error messages (keys match error codes)
    errorInvalidCredentials: 'Неверный email или пароль',
    errorUserAlreadyRegistered: 'Пользователь с таким email уже зарегистрирован',
    errorPasswordTooShort: 'Пароль должен быть не короче 6 символов',
    errorEmailNotConfirmed: 'Email не подтверждён — проверь почту',
    errorDisplayNameTaken: 'Это имя пользователя уже занято — выбери другое',
    errorDisplayNameRequired: 'Введи имя пользователя',
    errorDisplayNameTooLong: 'Имя пользователя должно быть не длиннее 50 символов',
    errorPasswordsDoNotMatch: 'Пароли не совпадают',
    errorGeneric: 'Что-то пошло не так',
    errorInviteExpired: 'Код приглашения истёк или недействителен',
    errorNetworkError: 'Ошибка сети, попробуйте ещё раз',

    // Info messages
    infoEmailSent: 'Если аккаунт с таким email существует, письмо со ссылкой для сброса пароля уже отправлено.',
    infoRegistrationSuccess: 'Почти готово! Мы отправили письмо на {email} — перейди по ссылке из письма, чтобы подтвердить регистрацию, и затем войди.',
  }
};