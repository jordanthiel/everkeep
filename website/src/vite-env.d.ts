/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOWNLOAD_MAC?: string
  readonly VITE_DOWNLOAD_WIN?: string
  readonly VITE_RELEASES_URL?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_STRIPE_PAYMENT_LINK?: string
  readonly VITE_LICENSE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
