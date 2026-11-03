import api from './api.js';

export async function signInWithGoogle(credential) {
  return (await api.post('/auth/google', { credential })).data.user;
}

export async function getProfile() {
  return (await api.get('/auth/profile')).data.user;
}

export async function signOut() {
  await api.post('/auth/logout', {});
}
