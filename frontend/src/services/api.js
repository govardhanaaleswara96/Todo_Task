import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  timeout: 15000,
  // Browser sends the HttpOnly session cookie; JS never reads the JWT.
  withCredentials: true,
});

export async function getHealth() {
  return (await api.get('/health')).data;
}

export default api;
