import { supabase } from '../supabase-client.js';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;

        // Роль текущего пользователя в мире, который сейчас открыт.
        // ВАЖНО: это НЕ свойство аккаунта — один и тот же человек может
        // быть 'dm' в одном мире и 'player' в другом. Application должен
        // вызывать setCurrentWorldRole() сразу после того, как определил,
        // в каком мире пользователь находится, и до того как
        // инициализируются любые сервисы, которые спрашивают isDM().
        this.currentWorldRole = null;
    }

    // Проверить, свободно ли отображаемое имя — используется на форме
    // регистрации ещё до отправки, как подсказка пользователю.
    // Не единственная защита: финальную уникальность обеспечивает
    // ограничение unique на колонке profiles.display_name.
    async checkDisplayNameAvailable(name) {
        const { data, error } = await supabase.rpc('is_display_name_available', { _name: name });
        if (error) {
            console.warn('⚠️ Could not check display name availability:', error.message);
            return true; // не блокируем пользователя из-за сетевой ошибки проверки
        }
        return data;
    }

    // Регистрация нового пользователя
    async signUp(email, password, displayName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName }
            }
        });

        if (error) {
            console.warn('❌ Sign up error:', error.message);
            return { success: false, error: this.translateError(error) };
        }

        // Если в проекте включено подтверждение email, Supabase не выдаёт
        // сессию сразу — пользователь должен перейти по ссылке из письма.
        const needsEmailConfirmation = !data.session;

        if (!needsEmailConfirmation) {
            await this.setCurrentUserFromSession(data.session);
        }

        console.log(`✅ Registered: ${email}${needsEmailConfirmation ? ' (ожидает подтверждения email)' : ''}`);
        return { success: true, needsEmailConfirmation, user: data.user };
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

    // Полностью и безвозвратно удалить свой аккаунт (все свои миры,
    // участие в чужих мирах, профиль — всё каскадно удалится в БД)
    async deleteMyAccount() {
        const { error } = await supabase.rpc('delete_my_account');

        if (error) {
            console.warn('❌ Delete account error:', error.message);
            return { success: false, error: this.translateError(error) };
        }

        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentWorldRole = null;

        return { success: true };
    }

    // Выход
    async logout() {
        await supabase.auth.signOut();
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentWorldRole = null;
        console.log('🚪 The user logged out');
    }

    // Запросить письмо для сброса пароля
    async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });

        if (error) {
            console.warn('❌ Reset password error:', error.message);
            return { success: false, error: this.translateError(error) };
        }

        return { success: true };
    }

    // Установить новый пароль — вызывается на экране, который открывается
    // по ссылке из письма восстановления (см. onAuthStateChange в main.js)
    async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            console.warn('❌ Update password error:', error.message);
            return { success: false, error: this.translateError(error) };
        }

        return { success: true };
    }

    // Проверка активной сессии — вызывается при запуске приложения.
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

    // Собрать объект текущего пользователя из сессии + его профиля
    async setCurrentUserFromSession(session) {
        const user = session.user;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.warn('⚠️ Could not load profile:', error.message);
        }

        this.currentUser = {
            id: user.id,
            email: user.email,
            displayName: profile?.display_name || user.email
        };
        this.isAuthenticated = true;
    }

    // Роль в конкретном мире устанавливает Application (main.js) сразу
    // после того, как определит, какой мир открыт — см. комментарий
    // в конструкторе.
    setCurrentWorldRole(role) {
        this.currentWorldRole = role;
    }

    getCurrentWorldRole() {
        return this.currentWorldRole;
    }

    isDM() {
        return this.currentWorldRole === 'dm';
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getIsAuthenticated() {
        return this.isAuthenticated;
    }

    // Подписка на изменения статуса авторизации — используется в том числе
    // для обработки ссылки восстановления пароля (событие PASSWORD_RECOVERY)
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(async (event, session) => {
            if (session && event !== 'PASSWORD_RECOVERY') {
                await this.setCurrentUserFromSession(session);
            } else if (!session) {
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
            'Email not confirmed': 'Email не подтверждён — проверь почту',
            'A user with this email address has already been registered': 'Пользователь с таким email уже зарегистрирован'
        };

        if (error.message?.includes('duplicate key value') && error.message?.includes('profiles_display_name_key')) {
            return 'Это имя уже занято — выбери другое';
        }

        return messages[error.message] || error.message;
    }
}

export default new AuthService();
