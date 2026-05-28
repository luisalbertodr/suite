import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { CompanyProvider } from '@/hooks/useCompanyFilter'
import { ThemeProvider } from '@/components/ThemeProvider'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <App />
          </ThemeProvider>
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
