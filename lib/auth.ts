// Hardcoded users for demo purposes
export const DEMO_USERS = [
  // Legacy demo users (keeping full admin access)
  { id: 1, username: 'user142', password: '2533', role: 'legacy_admin' },
  { id: 2, username: 'user523', password: '9313', role: 'legacy_admin' },
  { id: 3, username: 'user622', password: '1231', role: 'legacy_admin' },
  { id: 4, username: 'user789', password: '4567', role: 'legacy_admin' },
  { id: 5, username: 'user234', password: '8901', role: 'legacy_admin' },
  { id: 6, username: 'user567', password: '2345', role: 'legacy_admin' },
  { id: 7, username: 'user890', password: '6789', role: 'legacy_admin' },
  { id: 8, username: 'user123', password: '0123', role: 'legacy_admin' },
  { id: 9, username: 'user456', password: '3456', role: 'legacy_admin' },
  { id: 10, username: 'user999', password: '9999', role: 'legacy_admin' },
  { id: 11, username: 'demo1', password: 'pass1', role: 'legacy_admin' },
  
  // New demo user accounts
  { id: 12, username: 'visitor_7k9m', password: 'demo123', role: 'user' },
  { id: 13, username: 'guest_3x8n', password: 'demo123', role: 'user' },
  { id: 14, username: 'user_5p2q', password: 'demo123', role: 'user' },
  { id: 15, username: 'demo_9r4s', password: 'demo123', role: 'user' },
  { id: 16, username: 'viewer_6t1u', password: 'demo123', role: 'user' },
  
  // Admin accounts
  { id: 17, username: 'admin1', password: 'admin123', role: 'admin' },
  { id: 18, username: 'admin2', password: 'admin123', role: 'admin' }
]

export interface User {
  id: number
  username: string
  password: string
  role: 'user' | 'admin' | 'legacy_admin'
}

// Simple session storage (in production, use proper session management)
const SESSION_KEY = 'sara_user_session'

export function authenticateUser(username: string, password: string): User | null {
  const user = DEMO_USERS.find(u => u.username === username && u.password === password)
  return user ? { ...user, role: user.role as 'user' | 'admin' | 'legacy_admin' } : null
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

// Helper functions for role-based permissions
export function isAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin' || user?.role === 'legacy_admin'
}

export function isUser(): boolean {
  const user = getCurrentUser()
  return user?.role === 'user'
}

export function isLegacyAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'legacy_admin'
}

export function canSaveQueries(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin' || user?.role === 'legacy_admin'
}

export function canUpdateQueries(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin' || user?.role === 'legacy_admin'
}

export function canSaveDashboards(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin' || user?.role === 'legacy_admin'
}

export function canUpdateDashboards(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin' || user?.role === 'legacy_admin'
}
