// Hardcoded users for demo purposes
export const DEMO_USERS = [
  { id: 1, username: 'user142', password: '2533' },
  { id: 2, username: 'user523', password: '9313' },
  { id: 3, username: 'user622', password: '1231' },
  { id: 4, username: 'user789', password: '4567' },
  { id: 5, username: 'user234', password: '8901' },
  { id: 6, username: 'user567', password: '2345' },
  { id: 7, username: 'user890', password: '6789' },
  { id: 8, username: 'user123', password: '0123' },
  { id: 9, username: 'user456', password: '3456' },
  { id: 10, username: 'user999', password: '9999' }
]

export interface User {
  id: number
  username: string
  password: string
}

// Simple session storage (in production, use proper session management)
const SESSION_KEY = 'sara_user_session'

export function authenticateUser(username: string, password: string): User | null {
  const user = DEMO_USERS.find(u => u.username === username && u.password === password)
  return user || null
}

export function createSession(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  }
}

export function getCurrentUser(): User | null {
  if (typeof window !== 'undefined') {
    const session = localStorage.getItem(SESSION_KEY)
    return session ? JSON.parse(session) : null
  }
  return null
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null
}
