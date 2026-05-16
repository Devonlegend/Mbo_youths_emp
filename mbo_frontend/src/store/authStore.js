import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user:    null,
  token:   localStorage.getItem('access_token') || null,
  isReady: false,

  setUser: (user) => set({ user }),

  login: (tokens, user) => {
    localStorage.setItem('access_token',  tokens.access)
    localStorage.setItem('refresh_token', tokens.refresh)
    set({ token: tokens.access, user })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ token: null, user: null })
  },

  setReady: () => set({ isReady: true }),
}))

export default useAuthStore