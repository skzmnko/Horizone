import { supabase } from '../supabase-client.js';
import { ERROR_CODES, mapSupabaseErrorToCode } from '../core/error-codes.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.currentWorldRole = null;
  }

  async checkDisplayNameAvailable(name) {
    const { data, error } = await supabase.rpc('is_display_name_available', { _name: name });
    if (error) {
      console.warn('⚠️ Could not check display name availability:', error.message);
      return true;
    }
    return data;
  }

  async signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    if (error) {
      console.warn('❌ Sign up error:', error.message);
      return { success: false, errorCode: mapSupabaseErrorToCode(error.message) };
    }
    const needsEmailConfirmation = !data.session;
    if (!needsEmailConfirmation) {
      await this.setCurrentUserFromSession(data.session);
    }
    console.log(`✅ Registered: ${email}${needsEmailConfirmation ? ' (ожидает подтверждения email)' : ''}`);
    return { success: true, needsEmailConfirmation, user: data.user };
  }

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn('❌ Login error:', error.message);
      return { success: false, errorCode: mapSupabaseErrorToCode(error.message) };
    }
    await this.setCurrentUserFromSession(data.session);
    console.log(`✅ Successful login: ${this.currentUser.displayName}`);
    return { success: true, user: this.currentUser };
  }

  async deleteMyAccount() {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      console.warn('❌ Delete account error:', error.message);
      return { success: false, errorCode: mapSupabaseErrorToCode(error.message) };
    }
    this.currentUser = null;
    this.isAuthenticated = false;
    this.currentWorldRole = null;
    return { success: true };
  }

  async logout() {
    await supabase.auth.signOut();
    this.currentUser = null;
    this.isAuthenticated = false;
    this.currentWorldRole = null;
    console.log('🚪 The user logged out');
  }

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) {
      console.warn('❌ Reset password error:', error.message);
      return { success: false, errorCode: mapSupabaseErrorToCode(error.message) };
    }
    return { success: true };
  }

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.warn('❌ Update password error:', error.message);
      return { success: false, errorCode: mapSupabaseErrorToCode(error.message) };
    }
    return { success: true };
  }

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
}

export default new AuthService();