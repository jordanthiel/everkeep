import { BackupOpenNotice } from '@renderer/components/layout/BackupOpenNotice'
import { useLocation } from 'react-router-dom'
import { SectionHomePage } from '@renderer/pages/SectionHomePage'
import { TopicIntroPage } from '@renderer/pages/TopicIntroPage'
import { FinishPage } from '@renderer/pages/FinishPage'
import { useEffect, useState } from 'react'
import { createHashRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@renderer/components/layout/AppShell'
import { WelcomePage } from '@renderer/pages/WelcomePage'
import { CreateVaultPage } from '@renderer/pages/CreateVaultPage'
import { DashboardPage } from '@renderer/pages/DashboardPage'
import { PeoplePage } from '@renderer/pages/PeoplePage'
import { FinancialPage } from '@renderer/pages/FinancialPage'
import { EntriesSectionPage } from '@renderer/pages/EntriesSectionPage'
import { UnlockPage } from '@renderer/pages/UnlockPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { ExportPage } from '@renderer/pages/ExportPage'
import { HandoffPage } from '@renderer/pages/HandoffPage'
import { BackupPage } from '@renderer/pages/BackupPage'
import { RestoreVaultPage } from '@renderer/pages/RestoreVaultPage'
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

useVaultStore.subscribe((state, previous) => {
  if (state.session?.metadata.id !== previous.session?.metadata.id || state.session?.isLocked) queryClient.clear()
})

function SectionRoute({ id }: { id: VaultSectionId }) {
  return <EntriesSectionPage key={id} sectionId={id} />
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

function RestoreRoute() {
  const location = useLocation()
  return <RestoreVaultPage key={location.search} />
}

const router = createHashRouter(createRoutesFromElements(
  <Route element={<><UpdateBanner /><BackupOpenNotice /><Outlet /></>}>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/create-vault" element={<CreateVaultPage />} />
          <Route path="/restore" element={<RestoreRoute />} />
          <Route path="/unlock" element={<UnlockPage />} />
          <Route
            element={
              <VaultGate>
                <AppShell />
              </VaultGate>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sections/:groupId" element={<SectionHomePage />} />
            <Route path="/guide/:topicId" element={<TopicIntroPage />} />
            <Route path="/finish" element={<FinishPage />} />
            <Route path="/start-here" element={<HandoffPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/contacts" element={<Navigate to="/people" replace />} />
            <Route path="/dependents" element={<SectionRoute id="dependents" />} />
            <Route path="/debts" element={<SectionRoute id="debts" />} />
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
  </Route>
))

export default function App() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
