import type { VaultSectionId } from '../types/entry'

export type SectionFieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'sensitive'

export interface SectionFieldDef {
  key: string
  label: string
  type: SectionFieldType
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  required?: boolean
  /** Stored encrypted when the vault is password-protected. */
  sensitive?: boolean
}

export interface SectionDefinition {
  id: VaultSectionId
  title: string
  description: string
  badge?: string
  path: string
  addLabel: string
  kindLabel?: string
  kinds?: Array<{ value: string; label: string }>
  titleLabel?: string
  titlePlaceholder?: string
  fields: SectionFieldDef[]
  showLocation?: boolean
  showNotes?: boolean
  disclaimer?: string
}

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 'identity',
    title: 'Identity',
    description: 'Legal identity details and documents your family may need to locate.',
    path: '/identity',
    addLabel: 'Add identity record',
    kindLabel: 'Record type',
    kinds: [
      { value: 'legal_name', label: 'Legal name' },
      { value: 'ssn', label: 'Social Security / national ID' },
      { value: 'drivers_license', label: 'Driver license' },
      { value: 'passport', label: 'Passport' },
      { value: 'marriage', label: 'Marriage' },
      { value: 'divorce', label: 'Divorce' },
      { value: 'military', label: 'Military' },
      { value: 'citizenship', label: 'Citizenship' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. U.S. Passport',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'fullLegalName', label: 'Full legal name', type: 'text' },
      { key: 'previousNames', label: 'Previous names', type: 'text' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
      { key: 'placeOfBirth', label: 'Place of birth', type: 'text' },
      { key: 'number', label: 'ID / document number', type: 'sensitive', sensitive: true },
      { key: 'issued', label: 'Issued', type: 'date' },
      { key: 'expires', label: 'Expires', type: 'date' },
      { key: 'issuingAuthority', label: 'Issuing authority', type: 'text' }
    ],
    disclaimer: 'Sensitive identifiers are masked in lists and encrypted in password-protected vaults.'
  },
  {
    id: 'legal',
    title: 'Legal & Estate',
    description: 'Record what exists and where — Everkeep does not create legal documents.',
    path: '/legal',
    addLabel: 'Add legal record',
    kindLabel: 'Document type',
    kinds: [
      { value: 'will', label: 'Will' },
      { value: 'trust', label: 'Trust' },
      { value: 'poa_financial', label: 'Financial power of attorney' },
      { value: 'poa_healthcare', label: 'Healthcare power of attorney' },
      { value: 'advance_directive', label: 'Advance directive' },
      { value: 'guardianship', label: 'Guardianship preferences' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Last Will and Testament',
    showLocation: true,
    showNotes: true,
    fields: [
      {
        key: 'exists',
        label: 'Exists?',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'unknown', label: 'Unknown' }
        ]
      },
      { key: 'dateSigned', label: 'Date signed / created', type: 'date' },
      { key: 'attorney', label: 'Attorney', type: 'text' },
      { key: 'executorOrAgent', label: 'Executor / agent / trustee', type: 'text' },
      { key: 'alternate', label: 'Alternate', type: 'text' },
      { key: 'copyLocation', label: 'Copy location', type: 'text' },
      { key: 'taxId', label: 'Tax ID (if relevant)', type: 'sensitive', sensitive: true }
    ],
    disclaimer:
      'Entering a guardian or agent here records your preference. It does not by itself establish legal authority.'
  },
  {
    id: 'insurance',
    title: 'Insurance',
    description: 'Policies your family would need to find quickly.',
    path: '/insurance',
    addLabel: 'Add policy',
    kindLabel: 'Policy type',
    kinds: [
      { value: 'life', label: 'Life' },
      { value: 'homeowners', label: 'Homeowners' },
      { value: 'auto', label: 'Auto' },
      { value: 'umbrella', label: 'Umbrella' },
      { value: 'disability', label: 'Disability' },
      { value: 'long_term_care', label: 'Long-term care' },
      { value: 'health', label: 'Health' },
      { value: 'renters', label: 'Renters' },
      { value: 'business', label: 'Business' },
      { value: 'valuable_property', label: 'Valuable property' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Northwestern Mutual Life',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'carrier', label: 'Carrier', type: 'text', required: true },
      { key: 'policyNumber', label: 'Policy number', type: 'text' },
      { key: 'insured', label: 'Insured', type: 'text' },
      { key: 'owner', label: 'Policy owner', type: 'text' },
      { key: 'agent', label: 'Agent', type: 'text' },
      { key: 'coverageAmount', label: 'Coverage amount', type: 'text' },
      {
        key: 'termOrPermanent',
        label: 'Term / permanent',
        type: 'select',
        options: [
          { value: '', label: '—' },
          { value: 'term', label: 'Term' },
          { value: 'permanent', label: 'Permanent' },
          { value: 'other', label: 'Other / N/A' }
        ]
      },
      { key: 'beneficiaries', label: 'Beneficiaries', type: 'textarea' },
      { key: 'premium', label: 'Premium', type: 'text' },
      { key: 'paymentSource', label: 'Payment source', type: 'text' }
    ]
  },
  {
    id: 'property',
    title: 'Property',
    description: 'Homes, vehicles, and access details that rarely live in one place.',
    path: '/property',
    addLabel: 'Add property',
    kindLabel: 'Property type',
    kinds: [
      { value: 'real_estate', label: 'Real estate' },
      { value: 'vehicle', label: 'Vehicle' },
      { value: 'boat', label: 'Boat' },
      { value: 'rv', label: 'RV' },
      { value: 'aircraft', label: 'Aircraft' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Primary residence',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'address', label: 'Address / description', type: 'textarea' },
      { key: 'ownership', label: 'Ownership', type: 'text' },
      { key: 'purchaseDate', label: 'Purchase date', type: 'date' },
      { key: 'year', label: 'Year (vehicles)', type: 'text' },
      { key: 'make', label: 'Make', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'vin', label: 'VIN / hull ID', type: 'text' },
      { key: 'mortgageOrLoan', label: 'Mortgage / loan', type: 'text' },
      { key: 'insurance', label: 'Insurance', type: 'text' },
      { key: 'titleLocation', label: 'Title / deed location', type: 'text' },
      { key: 'keysLocation', label: 'Keys location', type: 'text' },
      { key: 'accessInstructions', label: 'Access instructions', type: 'textarea' }
    ]
  },
  {
    id: 'income',
    title: 'Income & Employment',
    description: 'Employers, benefits, and recurring income sources.',
    path: '/income',
    addLabel: 'Add income or employment',
    kindLabel: 'Type',
    kinds: [
      { value: 'employment', label: 'Employment' },
      { value: 'salary', label: 'Salary / wages' },
      { value: 'pension', label: 'Pension' },
      { value: 'social_security', label: 'Social Security' },
      { value: 'rental', label: 'Rental income' },
      { value: 'business', label: 'Business income' },
      { value: 'dividends', label: 'Dividends' },
      { value: 'royalties', label: 'Royalties' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Acme Corp — Product Manager',
    showNotes: true,
    fields: [
      { key: 'employerOrSource', label: 'Employer / source', type: 'text' },
      { key: 'position', label: 'Position', type: 'text' },
      { key: 'hrContact', label: 'HR / contact', type: 'text' },
      { key: 'employeeId', label: 'Employee ID', type: 'text' },
      { key: 'benefits', label: 'Benefits', type: 'textarea' },
      { key: 'retirementPlan', label: 'Retirement plan', type: 'text' },
      { key: 'lifeInsurance', label: 'Employer life insurance', type: 'text' },
      { key: 'finalPaycheck', label: 'Final paycheck notes', type: 'textarea' },
      { key: 'approximateAmount', label: 'Approximate amount (optional)', type: 'text' }
    ]
  },
  {
    id: 'taxes',
    title: 'Taxes',
    description: 'Where returns live and who prepares them — not tax calculation.',
    path: '/taxes',
    addLabel: 'Add tax record',
    kindLabel: 'Type',
    kinds: [
      { value: 'preparer', label: 'CPA / preparer' },
      { value: 'returns_location', label: 'Returns location' },
      { value: 'irs_notes', label: 'IRS account notes' },
      { value: 'property_tax', label: 'Property tax' },
      { value: 'business_tax', label: 'Business tax' },
      { value: 'estimated', label: 'Estimated taxes' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Annual returns filing cabinet',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'preparer', label: 'CPA / preparer', type: 'text' },
      { key: 'filingStatus', label: 'Filing status', type: 'text' },
      { key: 'yearsCovered', label: 'Years covered', type: 'text' },
      { key: 'portalOrAccount', label: 'Portal / account notes', type: 'textarea' }
    ]
  },
  {
    id: 'healthcare',
    title: 'Healthcare',
    description: 'Optional medical context, proxies, and care preferences.',
    path: '/healthcare',
    addLabel: 'Add healthcare record',
    kindLabel: 'Type',
    kinds: [
      { value: 'doctor', label: 'Doctor' },
      { value: 'insurance', label: 'Health insurance' },
      { value: 'pharmacy', label: 'Pharmacy' },
      { value: 'medication', label: 'Medication' },
      { value: 'allergy', label: 'Allergy' },
      { value: 'condition', label: 'Condition' },
      { value: 'proxy', label: 'Healthcare proxy' },
      { value: 'directive', label: 'Advance directive' },
      { value: 'hospital', label: 'Preferred hospital' },
      { value: 'organ_donation', label: 'Organ donation' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Primary care physician',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'provider', label: 'Provider / name', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'details', label: 'Details', type: 'textarea' },
      { key: 'proxyAgent', label: 'Proxy / agent', type: 'text' }
    ]
  },
  {
    id: 'digital',
    title: 'Digital Life',
    description: 'Password managers, email, cloud accounts, and recovery instructions.',
    badge: 'High impact',
    path: '/digital',
    addLabel: 'Add digital account',
    kindLabel: 'Category',
    kinds: [
      { value: 'password_manager', label: 'Password manager' },
      { value: 'email', label: 'Email' },
      { value: 'apple_google_microsoft', label: 'Apple / Google / Microsoft' },
      { value: 'social', label: 'Social media' },
      { value: 'domain', label: 'Domain / website' },
      { value: 'cloud', label: 'Cloud storage' },
      { value: 'crypto', label: 'Cryptocurrency' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. 1Password family account',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'provider', label: 'Provider', type: 'text' },
      { key: 'accountIdentifier', label: 'Username / email', type: 'text' },
      { key: 'url', label: 'URL', type: 'text' },
      { key: 'instructions', label: 'Access / recovery instructions', type: 'textarea' },
      { key: 'preference', label: 'Memorialize / delete preference', type: 'text' },
      {
        key: 'seedWarning',
        label: 'Hardware wallet / seed phrase location (never store the seed itself)',
        type: 'text'
      }
    ],
    disclaimer:
      'Do not store every password or an unencrypted seed phrase here. Document how an authorized person gains access.'
  },
  {
    id: 'household',
    title: 'Household',
    description: 'Utilities, autopay, memberships, and practical home knowledge.',
    path: '/household',
    addLabel: 'Add household item',
    kindLabel: 'Type',
    kinds: [
      { value: 'utility', label: 'Utility' },
      { value: 'autopay', label: 'Autopay bill' },
      { value: 'subscription', label: 'Subscription' },
      { value: 'membership', label: 'Membership' },
      { value: 'service', label: 'Home service' },
      { value: 'instruction', label: 'Household instruction' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Electric company / spare key location',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'provider', label: 'Provider / merchant', type: 'text' },
      { key: 'accountOrReference', label: 'Account / reference', type: 'text' },
      { key: 'amount', label: 'Amount (optional)', type: 'text' },
      { key: 'frequency', label: 'Frequency', type: 'text' },
      { key: 'paymentAccount', label: 'Payment account', type: 'text' },
      {
        key: 'cancelAfterDeath',
        label: 'Cancel after death?',
        type: 'select',
        options: [
          { value: '', label: '—' },
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'unknown', label: 'Unknown' }
        ]
      },
      { key: 'instructions', label: 'Instructions', type: 'textarea' }
    ]
  },
  {
    id: 'personal-property',
    title: 'Personal Property',
    description: 'Meaningful assets and intended recipients — informational only.',
    path: '/personal-property',
    addLabel: 'Add item',
    kindLabel: 'Category',
    kinds: [
      { value: 'jewelry', label: 'Jewelry' },
      { value: 'art', label: 'Art' },
      { value: 'collectibles', label: 'Collectibles' },
      { value: 'firearms', label: 'Firearms' },
      { value: 'furniture', label: 'Furniture' },
      { value: 'electronics', label: 'Electronics' },
      { value: 'tools', label: 'Tools' },
      { value: 'heirloom', label: 'Family heirloom' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Grandmother’s ring',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'approximateValue', label: 'Approximate value', type: 'text' },
      { key: 'serialNumber', label: 'Serial number', type: 'text' },
      { key: 'intendedRecipient', label: 'Intended recipient', type: 'text' },
      { key: 'appraisalOrReceipt', label: 'Appraisal / receipt location', type: 'text' }
    ],
    disclaimer:
      '“Intended recipient” is informational only and does not necessarily create a legally binding bequest.'
  },
  {
    id: 'final-wishes',
    title: 'Final Wishes',
    description: 'Funeral preferences and related instructions, handled with care.',
    path: '/final-wishes',
    addLabel: 'Add wish or preference',
    kindLabel: 'Category',
    kinds: [
      { value: 'funeral', label: 'Funeral / memorial' },
      { value: 'burial', label: 'Burial' },
      { value: 'cremation', label: 'Cremation' },
      { value: 'donation', label: 'Body / organ donation' },
      { value: 'obituary', label: 'Obituary' },
      { value: 'charity', label: 'Charitable donations' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Memorial service preferences',
    showLocation: true,
    showNotes: true,
    fields: [
      {
        key: 'preference',
        label: 'Preference',
        type: 'select',
        options: [
          { value: '', label: '—' },
          { value: 'burial', label: 'Burial' },
          { value: 'cremation', label: 'Cremation' },
          { value: 'donation', label: 'Donation' },
          { value: 'undecided', label: 'Undecided' },
          { value: 'other', label: 'Other' }
        ]
      },
      { key: 'funeralHome', label: 'Funeral home', type: 'text' },
      { key: 'cemetery', label: 'Cemetery / plot', type: 'text' },
      { key: 'servicePreferences', label: 'Service preferences', type: 'textarea' },
      { key: 'musicReadings', label: 'Music / readings', type: 'textarea' },
      { key: 'registrationLocation', label: 'Official registration location', type: 'text' }
    ],
    disclaimer:
      'Everkeep records instructions and does not necessarily constitute the legally controlling document.'
  },
  {
    id: 'letters',
    title: 'Letters & Instructions',
    description: 'Private notes for family, executors, and trustees.',
    path: '/letters',
    addLabel: 'Add letter',
    kindLabel: 'Type',
    kinds: [
      { value: 'spouse', label: 'Letter to spouse' },
      { value: 'children', label: 'Letter to children' },
      { value: 'executor', label: 'Letter to executor' },
      { value: 'trustee', label: 'Letter to trustee' },
      { value: 'family', label: 'Family message' },
      { value: 'business', label: 'Business instructions' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Letter to executor',
    showNotes: true,
    fields: [
      { key: 'recipient', label: 'Recipient', type: 'text' },
      { key: 'body', label: 'Letter body', type: 'textarea', required: true },
      { key: 'date', label: 'Date', type: 'date' },
      {
        key: 'privateFlag',
        label: 'Private?',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes — handle discreetly' },
          { value: 'no', label: 'No' }
        ]
      }
    ]
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'References to important papers and where to find them.',
    path: '/documents',
    addLabel: 'Add document',
    kindLabel: 'Category',
    kinds: [
      { value: 'will', label: 'Will' },
      { value: 'trust', label: 'Trust' },
      { value: 'deed', label: 'Deed' },
      { value: 'insurance', label: 'Insurance policy' },
      { value: 'tax', label: 'Tax return' },
      { value: 'birth', label: 'Birth certificate' },
      { value: 'marriage', label: 'Marriage certificate' },
      { value: 'passport', label: 'Passport' },
      { value: 'title', label: 'Vehicle title' },
      { value: 'appraisal', label: 'Appraisal' },
      { value: 'business', label: 'Business agreement' },
      { value: 'other', label: 'Other' }
    ],
    titlePlaceholder: 'e.g. Deed — primary residence',
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'physicalLocation', label: 'Original physical location', type: 'text' },
      { key: 'electronicLocation', label: 'Electronic location', type: 'text' },
      { key: 'documentDate', label: 'Document date', type: 'date' },
      { key: 'expirationDate', label: 'Expiration date', type: 'date' }
    ]
  }
]

export function getSectionDefinition(id: VaultSectionId): SectionDefinition {
  const found = SECTION_DEFINITIONS.find((section) => section.id === id)
  if (!found) throw new Error(`Unknown section: ${id}`)
  return found
}
