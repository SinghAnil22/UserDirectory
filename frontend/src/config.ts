export const config = {
  /** Empty string = same origin (requests go to /api/... and are proxied by Vite / nginx). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  /** OAuth 2.0 Client ID from Google Cloud Console (type "Web application"). */
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
};
