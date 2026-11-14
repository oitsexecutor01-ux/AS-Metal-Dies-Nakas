const rawUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = (typeof rawUrl === 'string' && rawUrl.trim() !== '' ? rawUrl : 'https://as-metal-dies-nakas.onrender.com').replace(/\/+$/, '');

export function apiUrl(path = '') {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
