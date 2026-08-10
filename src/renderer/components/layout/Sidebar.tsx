import { NavLink } from 'react-router-dom'
import {
  Home,
  Users,
  Contact,
  Fingerprint,
  Scale,
  Landmark,
  Shield,
  Home as PropertyIcon,
  Briefcase,
  Receipt,
  HeartPulse,
  MonitorSmartphone,
  House,
  Gem,
  Flower2,
  Mail,
  FileText,
  ClipboardCheck,
  Download,
  Settings,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'
import { NAV_FOOTER, NAV_SECTIONS } from '@shared/constants'
import { EverkeepMark } from '@renderer/components/brand/EverkeepMark'
import { useUiStore } from '@renderer/state/uiStore'
import { useVaultStore } from '@renderer/state/vaultStore'
import { cn } from '@renderer/lib/utils'
import type { LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  home: Home,
  people: Users,
  contacts: Contact,
  identity: Fingerprint,
  legal: Scale,
  financial: Landmark,
  insurance: Shield,
  property: PropertyIcon,
  income: Briefcase,
  taxes: Receipt,
  healthcare: HeartPulse,
  digital: MonitorSmartphone,
  household: House,
  'personal-property': Gem,
  'final-wishes': Flower2,
  letters: Mail,
  documents: FileText,
  review: ClipboardCheck,
  export: Download,
  settings: Settings
}

function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
  completion
}: {
  to: string
  label: string
  icon: LucideIcon
  collapsed: boolean
  completion?: number
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
          isActive
            ? 'bg-forest-700/10 text-forest-700 font-medium'
            : 'text-charcoal-700 hover:bg-warm-100 hover:text-charcoal-900'
        )
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {typeof completion === 'number' && (
            <span className="text-xs tabular-nums text-warm-500">{completion}%</span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const session = useVaultStore((s) => s.session)

  const household =
    session?.metadata.householdName ||
    session?.metadata.name ||
    'Your Vault'

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-warm-200 bg-ivory-50/80 backdrop-blur-sm transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      <div className="app-drag-region flex items-center justify-between px-3 pb-3 pt-12">
        <div className="app-no-drag min-w-0">
          {collapsed ? (
            <EverkeepMark showWordmark={false} size="sm" />
          ) : (
            <div>
              <EverkeepMark size="sm" />
              <p className="mt-1 truncate pl-0.5 text-xs text-warm-500">{household}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="app-no-drag rounded-md p-1.5 text-warm-500 hover:bg-warm-100 hover:text-charcoal-800"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {NAV_SECTIONS.map((section) => {
          const Icon = iconMap[section.id] ?? FileText
          return (
            <NavItem
              key={section.id}
              to={section.path}
              label={section.label}
              icon={Icon}
              collapsed={collapsed}
            />
          )
        })}
      </nav>

      <div className="space-y-0.5 border-t border-warm-200 px-2 py-3">
        {NAV_FOOTER.map((item) => {
          const Icon = iconMap[item.id] ?? Settings
          return (
            <NavItem
              key={item.id}
              to={item.path}
              label={item.label}
              icon={Icon}
              collapsed={collapsed}
            />
          )
        })}
      </div>
    </aside>
  )
}
