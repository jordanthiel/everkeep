/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PAYMENT_LINK?: string
  readonly VITE_LICENSE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
