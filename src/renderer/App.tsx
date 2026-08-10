import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@renderer/components/layout/AppShell'
import { WelcomePage } from '@renderer/pages/WelcomePage'
import { CreateVaultPage } from '@renderer/pages/CreateVaultPage'
import { DashboardPage } from '@renderer/pages/DashboardPage'
import { PeoplePage } from '@renderer/pages/PeoplePage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { ExportPage } from '@renderer/pages/ExportPage'
import { PlaceholderSectionPage } from '@renderer/pages/PlaceholderSectionPage'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

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

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/create-vault" element={<CreateVaultPage />} />
          <Route
            element={
              <VaultGate>
                <AppShell />
              </VaultGate>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route
              path="/contacts"
              element={
                <PlaceholderSectionPage
                  title="Important Contacts"
                  description="Attorneys, advisors, doctors, and other professionals your family may need to reach."
                  badge="Phase 2 polish"
                />
              }
            />
            <Route
              path="/identity"
              element={
                <PlaceholderSectionPage
                  title="Identity"
                  description="Legal name, identifiers, and vital records — with careful reveal for sensitive fields."
                />
              }
            />
            <Route
              path="/legal"
              element={
                <PlaceholderSectionPage
                  title="Legal & Estate"
                  description="Wills, trusts, powers of attorney, and where the originals live."
                />
              }
            />
            <Route
              path="/financial"
              element={
                <PlaceholderSectionPage
                  title="Financial"
                  description="Accounts, ownership, and beneficiary designations for discovery — not net-worth tracking."
                />
              }
            />
            <Route
              path="/insurance"
              element={
                <PlaceholderSectionPage
                  title="Insurance"
                  description="Life, property, and other policies your family would need to find quickly."
                />
              }
            />
            <Route
              path="/property"
              element={
                <PlaceholderSectionPage
                  title="Property"
                  description="Homes, vehicles, and access details that rarely live in one place."
                />
              }
            />
            <Route
              path="/income"
              element={
                <PlaceholderSectionPage
                  title="Income & Employment"
                  description="Employers, benefits, and recurring income sources."
                  badge="Phase 2"
                />
              }
            />
            <Route
              path="/taxes"
              element={
                <PlaceholderSectionPage
                  title="Taxes"
                  description="Where returns live and who prepares them — not tax calculation."
                  badge="Phase 2"
                />
              }
            />
            <Route
              path="/healthcare"
              element={
                <PlaceholderSectionPage
                  title="Healthcare"
                  description="Optional medical context, proxies, and care preferences."
                  badge="Phase 2"
                />
              }
            />
            <Route
              path="/digital"
              element={
                <PlaceholderSectionPage
                  title="Digital Life"
                  description="Password managers, email, cloud accounts, and recovery instructions — not every password."
                />
              }
            />
            <Route
              path="/household"
              element={
                <PlaceholderSectionPage
                  title="Household"
                  description="Utilities, autopay, memberships, and the practical knowledge that lives in someone’s head."
                  badge="Phase 2"
                />
              }
            />
            <Route
              path="/personal-property"
              element={
                <PlaceholderSectionPage
                  title="Personal Property"
                  description="Meaningful assets and intended recipients, clearly labeled as informational."
                  badge="Phase 2"
                />
              }
            />
            <Route
              path="/final-wishes"
              element={
                <PlaceholderSectionPage
                  title="Final Wishes"
                  description="Funeral preferences and related instructions, handled with care."
                />
              }
            />
            <Route
              path="/letters"
              element={
                <PlaceholderSectionPage
                  title="Letters & Instructions"
                  description="Private notes for family, executors, and trustees."
                  badge="Phase 2"
                />
              }
            />
            <Route
              path="/documents"
              element={
                <PlaceholderSectionPage
                  title="Documents"
                  description="References and attachments for the papers that matter most."
                />
              }
            />
            <Route
              path="/review"
              element={
                <PlaceholderSectionPage
                  title="Review"
                  description="Surface information that hasn’t been confirmed in a while."
                />
              }
            />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
