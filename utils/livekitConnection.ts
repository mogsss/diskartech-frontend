import { URL } from 'react-native-url-polyfill';

export type CallConnection = { serverUrl: string; token: string };

// Validate the backend response structure. LiveKit verifies signature, expiry and room grants.
export function validateCallConnection(serverInput: string, tokenInput: string): CallConnection {
  const serverUrl = serverInput.trim();
  let url: URL;
  try { url = new URL(serverUrl); }
  catch { throw new Error('The video call server URL is invalid.'); }
  if (url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('The video call server URL must use a secure WebSocket connection.');
  }
  const token = tokenInput.trim();
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('The interview access token is invalid. Try joining again.');
  }
  return { serverUrl: serverUrl.replace(/\/$/, ''), token };
}
