/**
 * GoogleAuth — Google Identity Services wrapper for OAuth 2.0 implicit flow
 * No backend required. Client ID is safe to expose (origin-restricted).
 */
window.GoogleAuth = (() => {
  const CLIENT_ID = '408005498550-lbkpehtnh2it40q03m2b25ak72qtifvd.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiry = 0;
  let userProfile = null;
  let onAuthChangeCallback = null;

  function init(onAuthChange) {
    onAuthChangeCallback = onAuthChange;
    if (typeof google === 'undefined' || !google.accounts) return;

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: handleTokenResponse,
    });
  }

  function signIn() {
    if (!tokenClient) return;
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken);
    }
    accessToken = null;
    tokenExpiry = 0;
    userProfile = null;
    if (onAuthChangeCallback) onAuthChangeCallback(false);
  }

  async function handleTokenResponse(response) {
    if (response.error) {
      console.error('Auth error:', response.error);
      return;
    }
    accessToken = response.access_token;
    tokenExpiry = Date.now() + (response.expires_in * 1000);

    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const info = await res.json();
        userProfile = { email: info.email, name: info.name, picture: info.picture };
      }
    } catch (e) {
      console.warn('Failed to fetch user profile:', e);
    }

    if (onAuthChangeCallback) onAuthChangeCallback(true);
  }

  async function refreshToken() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error('Not initialized'));
      const origCallback = tokenClient.callback;
      tokenClient.callback = (response) => {
        tokenClient.callback = origCallback;
        if (response.error) return reject(new Error(response.error));
        accessToken = response.access_token;
        tokenExpiry = Date.now() + (response.expires_in * 1000);
        resolve(accessToken);
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  async function getAccessToken() {
    if (!accessToken) return null;
    if (Date.now() > tokenExpiry - 60000) {
      try {
        await refreshToken();
      } catch {
        signOut();
        return null;
      }
    }
    return accessToken;
  }

  function getUserProfile() { return userProfile; }
  function isSignedIn() { return !!accessToken; }

  return { init, signIn, signOut, getAccessToken, getUserProfile, isSignedIn, refreshToken };
})();
