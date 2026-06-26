import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { CompanyProvider } from '@/hooks/useCompanyFilter'
import { ThemeProvider } from '@/components/ThemeProvider'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita recargas masivas al volver de otra app (Marketing, agenda, etc.).
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 15 * 60_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <App />
        </ThemeProvider>
      </CompanyProvider>
    </AuthProvider>
  </QueryClientProvider>,
)
