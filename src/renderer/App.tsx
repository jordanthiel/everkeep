import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@renderer/components/layout/AppShell'
import { WelcomePage } from '@renderer/pages/WelcomePage'
import { CreateVaultPage } from '@renderer/pages/CreateVaultPage'
import { DashboardPage } from '@renderer/pages/DashboardPage'
import { PeoplePage } from '@renderer/pages/PeoplePage'
import { ContactsPage } from '@renderer/pages/ContactsPage'
import { FinancialPage } from '@renderer/pages/FinancialPage'
import { EntriesSectionPage } from '@renderer/pages/EntriesSectionPage'
import { UnlockPage } from '@renderer/pages/UnlockPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { ExportPage } from '@renderer/pages/ExportPage'
import { ReviewPage } from '@renderer/pages/ReviewPage'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { UpdateBanner } from '@renderer/components/updates/UpdateBanner'
import type { VaultSectionId } from '@shared/types/entry'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

function SectionRoute({ id }: { id: VaultSectionId }) {
  return <EntriesSectionPage sectionId={id} />
}

function VaultGate({ children }: { children: React.ReactNode }) {
  const session = useVaultStore((s) => s.session)
  const setSession = useVaultStore((s) => s.setSession)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const status = await unwrap(getEverkeepApi().vault.getStatus())
        setSession(status.session)
      } catch {
        setSession(null)
      } finally {
        setReady(true)
      }
    })()
  }, [setSession])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-warm-500">
        Opening Everkeep…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/welcome" replace />
  }

  if (session.isLocked) {
    return <Navigate to="/unlock" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <UpdateBanner />
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/create-vault" element={<CreateVaultPage />} />
          <Route path="/unlock" element={<UnlockPage />} />
          <Route
            element={
              <VaultGate>
                <AppShell />
              </VaultGate>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/identity" element={<SectionRoute id="identity" />} />
            <Route path="/legal" element={<SectionRoute id="legal" />} />
            <Route path="/financial" element={<FinancialPage />} />
            <Route path="/insurance" element={<SectionRoute id="insurance" />} />
            <Route path="/property" element={<SectionRoute id="property" />} />
            <Route path="/income" element={<SectionRoute id="income" />} />
            <Route path="/taxes" element={<SectionRoute id="taxes" />} />
            <Route path="/healthcare" element={<SectionRoute id="healthcare" />} />
            <Route path="/digital" element={<SectionRoute id="digital" />} />
            <Route path="/household" element={<SectionRoute id="household" />} />
            <Route path="/personal-property" element={<SectionRoute id="personal-property" />} />
            <Route path="/final-wishes" element={<SectionRoute id="final-wishes" />} />
            <Route path="/letters" element={<SectionRoute id="letters" />} />
            <Route path="/documents" element={<SectionRoute id="documents" />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
