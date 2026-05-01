'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, Role } from '@/types/api';
import { Loader2 } from 'lucide-react';

const AUTH_EXPIRY_KEY = 'auth_expires_at';

function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem(AUTH_EXPIRY_KEY);
}

function isSessionExpired() {
  const expiresAt = localStorage.getItem(AUTH_EXPIRY_KEY);
  if (!expiresAt) return true;

  const expiryTime = Number(expiresAt);
  return !Number.isFinite(expiryTime) || Date.now() >= expiryTime;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = pathname === '/login';

  const checkRoleAccess = (userRole: Role, path: string) => {
    if (path === '/login' || path === '/') return true;
    
    const restrictedPaths: Record<Role, string[]> = {
      SUPER_ADMIN: [],
      ADMIN: ['/users', '/settings'], // Admin can't delete, but also maybe restricted from some settings
      MANAGER: ['/users', '/settings', '/dashboard'], // Manager has own dashboard
      SR: ['/dashboard', '/delivery-ops', '/products', '/stock', '/users', '/settings'],
    };

    const restricted = restrictedPaths[userRole] || [];
    return !restricted.some(p => path.startsWith(p));
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (token && storedUser && !isSessionExpired()) {
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);
        
        // Handle root or login redirects
        if (isAuthPage || pathname === '/') {
          let target = '/dashboard';
          if (parsedUser.role === Role.SR) target = '/sr-dashboard';
          else if (parsedUser.role === Role.MANAGER) target = '/manager-dashboard';
          
          router.push(target);
          return;
        }

        // Protect routes based on role
        if (!checkRoleAccess(parsedUser.role, pathname)) {
          console.warn(`Access denied for role ${parsedUser.role} to ${pathname}`);
          let target = '/dashboard';
          if (parsedUser.role === Role.SR) target = '/sr-dashboard';
          else if (parsedUser.role === Role.MANAGER) target = '/manager-dashboard';
          
          router.push(target);
        }

      } else if (token || storedUser) {
        clearStoredAuth();
        setUser(null);
        if (!isAuthPage) {
          router.push('/login');
        }
      } else if (!isAuthPage) {
        router.push('/login');
      }
    } catch (e) {
      console.error("Auth init error:", e);
      clearStoredAuth();
      if (!isAuthPage) {
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pathname, isAuthPage, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const checkSession = () => {
      if (isSessionExpired()) {
        clearStoredAuth();
        setUser(null);
        router.push('/login');
      }
    };

    checkSession();
    const intervalId = window.setInterval(checkSession, 30 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, router]);

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    router.push('/login');
  };

  const value = useMemo(() => ({ user, isLoading, logout }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="text-zinc-400 text-sm font-medium animate-pulse">Authenticating...</p>
          </div>
        </div>
      )}
      {!isLoading && !user && !isAuthPage && (
        <div className="fixed inset-0 z-[9998] bg-zinc-950" />
      )}
    </AuthContext.Provider>
  );
}
