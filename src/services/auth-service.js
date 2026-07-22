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

      // IMPORTANT: Supabase Auth (GoTrue) deliberately does not forward to the
      // client the reason for a failure in the trigger that creates the profiles
      // record — it always returns the same generic text ("Database error
      // saving new user") regardless of what exactly went wrong inside the
      // trigger. Matching a specific cause ("display_name is already taken") to
      // this text is unreliable and will break with any change to the wording on
      // the Supabase side.
      //
      // Therefore, instead of guessing based on error.message, we ASK THE
      // DATABASE directly whether the name is free right now — since signUp()
      // failed and the name suddenly became taken, that is almost certainly the
      // cause of the failure.
      const nameStillAvailable = await this.checkDisplayNameAvailable(displayName);
      if (!nameStillAvailable) {
        return { success: false, errorCode: ERROR_CODES.DISPLAY_NAME_TAKEN };
      }

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

  // Used by the Account settings page. displayName ("Account name") is
  // unique across the app, so it's only availability-checked (and only
  // touched at all) when it actually changed — first/last name have no
  // such constraint and are always written as given.
  async updateProfile({ firstName, lastName, displayName }) {
    const current = this.currentUser;
    const trimmedDisplayName = (displayName || '').trim();
    const displayNameChanged = current && trimmedDisplayName !== current.displayName;

    if (displayNameChanged) {
      if (!trimmedDisplayName) {
        return { success: false, errorCode: ERROR_CODES.GENERIC };
      }
      const available = await this.checkDisplayNameAvailable(trimmedDisplayName);
      if (!available) {
        return { success: false, errorCode: ERROR_CODES.DISPLAY_NAME_TAKEN };
      }
    }

    const updatePayload = {
      first_name: (firstName || '').trim() || null,
      last_name: (lastName || '').trim() || null
    };
    if (displayNameChanged) {
      updatePayload.display_name = trimmedDisplayName;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', current.id);

    if (error) {
      console.warn('❌ Update profile error:', error.message);
      return { success: false, errorCode: mapSupabaseErrorToCode(error.message) };
    }

    this.currentUser = {
      ...current,
      firstName: updatePayload.first_name || '',
      lastName: updatePayload.last_name || '',
      displayName: displayNameChanged ? trimmedDisplayName : current.displayName
    };

    return { success: true };
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
      .select('display_name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      console.warn('⚠️ Could not load profile:', error.message);
    }
    this.currentUser = {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name || user.email,
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || ''
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