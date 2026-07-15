import { supabase } from '../supabase-client.js';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
    }

    // Регистрация нового пользователя (пригодится, когда будем делать форму регистрации)
    async signUp(email, password, displayName = '') {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName || email.split('@')[0] }
            }
        });

        if (error) {
            console.warn('❌ Sign up error:', error.message);
            return { success: false, error: this.translateError(error) };
        }

        console.log(`✅ Registered: ${email}`);
        return { success: true, user: data.user };
    }

    // Вход по email + паролю
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.warn('❌ Login error:', error.message);
            return { success: false, error: this.translateError(error) };
        }

        await this.setCurrentUserFromSession(data.session);

        console.log(`✅ Successful login: ${this.currentUser.displayName}`);
        return { success: true, user: this.currentUser };
    }

    // Выход
    async logout() {
        await supabase.auth.signOut();
        this.currentUser = null;
        this.isAuthenticated = false;
        console.log('🚪 The user logged out');
    }

    // Проверка активной сессии — вызывается при запуске приложения.
    // Supabase сам хранит сессию (в localStorage), поэтому обновление
    // страницы не разлогинивает пользователя.
    async checkAuthStatus() {
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
            this.currentUser = null;
            this.isAuthenticated = false;
            return false;
        }

        await this.setCurrentUserFromSession(data.session);
        console.log(`🔐 Automatic login: ${this.currentUser.displayName}`);
        return true;
    }

    // Собрать объект текущего пользователя из сессии.
    //
    // ВАЖНО (временное решение): роль пока читаем из user_metadata самого
    // пользователя (поле role в Supabase Auth → Users → Raw user meta data).
    // Это упрощение для первого шага миграции. Когда будет готов
    // WorldsService (следующий шаг плана), роль должна определяться не
    // глобально, а per-world — через таблицу world_members, потому что
    // один и тот же человек может быть мастером в одном мире и игроком
    // в другом. Схема из плана это уже предусматривает.
    async setCurrentUserFromSession(session) {
        const user = session.user;

        const role = user.user_metadata?.role || 'player';
        const displayName = user.user_metadata?.display_name || user.email;

        this.currentUser = {
            id: user.id,
            email: user.email,
            role,
            displayName
        };
        this.isAuthenticated = true;
    }

    hasRole(role) {
        return this.isAuthenticated && this.currentUser?.role === role;
    }

    isDM() {
        return this.hasRole('dm');
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getIsAuthenticated() {
        return this.isAuthenticated;
    }

    // Подписка на изменения статуса авторизации (например, если пользователь
    // разлогинился в другой вкладке — можно среагировать в интерфейсе)
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                await this.setCurrentUserFromSession(session);
            } else {
                this.currentUser = null;
                this.isAuthenticated = false;
            }
            callback(event, this.currentUser);
        });
    }

    translateError(error) {
        const messages = {
            'Invalid login credentials': 'Неверный email или пароль',
            'User already registered': 'Пользователь с таким email уже зарегистрирован',
            'Password should be at least 6 characters': 'Пароль должен быть не короче 6 символов',
            'Email not confirmed': 'Email не подтверждён — проверь почту или отключи подтверждение в настройках Supabase на время разработки'
        };
        return messages[error.message] || error.message;
    }
}

export default new AuthService();