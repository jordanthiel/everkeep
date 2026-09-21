import type { VaultSectionId } from '../types/entry'
import type { PersonRole } from '../types/person'

export type SectionFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'select'
  | 'sensitive'
  | 'person'

export interface SectionFieldDef {
  key: string
  label: string
  type: SectionFieldType
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  required?: boolean
  /** Stored encrypted when the vault is password-protected. */
  sensitive?: boolean
  /** When set, the field is shown only for these record kinds. */
  forKinds?: string[]
  /** When this person is chosen, add this assignment on their contact. */
  assignRole?: PersonRole
  /** Store more than one contact id, comma-separated. */
  multi?: boolean
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
  /** When true, title is generated from the record type and key fields. */
  hideTitle?: boolean
  fields: SectionFieldDef[]
  showLocation?: boolean
  showNotes?: boolean
  showAttachments?: boolean
  disclaimer?: string
}

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 'dependents', title: 'Children, Dependents & Pets', path: '/dependents',
    description: 'Practical care instructions for anyone who depends on you.', addLabel: 'Add care profile',
    kindLabel: 'Who needs care?', kinds: [{ value: 'child', label: 'Child' }, { value: 'adult', label: 'Dependent adult' }, { value: 'pet', label: 'Pet' }],
    titleLabel: 'Name', titlePlaceholder: 'Name of the person or pet', showNotes: true,
    fields: [
      { key: 'caregiver', label: 'Primary caregiver', type: 'person' },
      { key: 'backupCaregiver', label: 'Backup caregiver', type: 'person' },
      { key: 'routine', label: 'Daily routine and immediate needs', type: 'textarea' },
      { key: 'school', label: 'School / daycare and pickup instructions', type: 'textarea', forKinds: ['child'] },
      { key: 'careNeeds', label: 'Care needs, medications, and allergies', type: 'textarea' },
      { key: 'accessibility', label: 'Communication and accessibility needs', type: 'textarea', forKinds: ['child', 'adult'] },
      { key: 'veterinarian', label: 'Veterinarian and phone', type: 'text', forKinds: ['pet'] },
      { key: 'microchip', label: 'Microchip and registration location', type: 'text', forKinds: ['pet'] },
      { key: 'supplies', label: 'Food, supplies, and important belongings', type: 'textarea' },
      { key: 'legalDocuments', label: 'Relevant care or guardianship documents — location', type: 'text', forKinds: ['child', 'adult'] }
    ], disclaimer: 'These are care instructions. Naming a caregiver here does not establish legal guardianship or authority.'
  },
  {
    id: 'debts', title: 'Bills & Debts', path: '/debts', description: 'Identify obligations, payment arrangements, and the right contact for questions.', addLabel: 'Add bill or debt',
    kinds: [{ value: 'mortgage', label: 'Mortgage' }, { value: 'credit_card', label: 'Credit card' }, { value: 'loan', label: 'Loan' }, { value: 'bill', label: 'Recurring bill' }, { value: 'other', label: 'Other obligation' }],
    titlePlaceholder: 'e.g. Home mortgage', showNotes: true,
    fields: [
      { key: 'creditor', label: 'Lender / provider', type: 'text', required: true },
      { key: 'borrower', label: 'Borrower / account holder', type: 'person', multi: true },
      { key: 'cosigner', label: 'Co-signer', type: 'person', multi: true },
      { key: 'authorizedUser', label: 'Authorized user (not an owner)', type: 'person', multi: true, forKinds: ['credit_card'] },
      { key: 'reference', label: 'Last four digits / reference', type: 'text' },
      { key: 'dueDate', label: 'Due date or day of month', type: 'text' },
      { key: 'amount', label: 'Usual payment (optional)', type: 'text' },
      { key: 'paymentSource', label: 'Autopay source / payment instructions', type: 'text' },
      { key: 'linkedAsset', label: 'Related property or vehicle', type: 'text', forKinds: ['mortgage', 'loan'] },
      { key: 'contact', label: 'Provider contact details', type: 'textarea' },
      { key: 'action', label: 'Instructions for the person helping', type: 'select', options: [{ value: '', label: 'Choose…' }, { value: 'keep', label: 'Keep running for household continuity' }, { value: 'ask', label: 'Ask the adviser / provider first' }, { value: 'cancel', label: 'Consider cancellation after review' }] }
    ], disclaimer: 'Listing a debt does not determine who legally owes it. A surviving relative is not automatically personally liable. Check with the relevant professional before paying or closing accounts.'
  },
  {
    id: 'identity',
    title: 'Identity',
    description:
      'IDs are stored on each contact. This page groups passports, Social Security numbers, and licenses by person.',
    path: '/identity',
    addLabel: 'Save',
    kindLabel: 'Record type',
    hideTitle: true,
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
    showLocation: true,
    showNotes: true,
    fields: [
      { key: 'personId', label: 'Belongs to', type: 'person', required: true },
      {
        key: 'fullLegalName',
        label: 'Full legal name',
        type: 'text',
        placeholder: 'As it appears on government documents',
        forKinds: ['legal_name']
      },
      { key: 'previousNames', label: 'Previous names', type: 'text', forKinds: ['legal_name'] },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date', forKinds: ['legal_name'] },
      { key: 'placeOfBirth', label: 'Place of birth', type: 'text', forKinds: ['legal_name'] },
      {
        key: 'spouseName',
        label: 'Spouse / other party',
        type: 'text',
        forKinds: ['marriage', 'divorce']
      },
      {
        key: 'number',
        label: 'ID / document number',
        type: 'sensitive',
        sensitive: true,
        forKinds: ['ssn', 'drivers_license', 'passport', 'military', 'citizenship', 'other']
      },
      {
        key: 'issued',
        label: 'Issued',
        type: 'date',
        forKinds: ['drivers_license', 'passport', 'marriage', 'divorce', 'military', 'citizenship', 'other']
      },
      {
        key: 'expires',
        label: 'Expires',
        type: 'date',
        forKinds: ['drivers_license', 'passport', 'other']
      },
      {
        key: 'issuingAuthority',
        label: 'Issuing authority',
        type: 'text',
        placeholder: 'U.S. Department of State…',
        forKinds: ['ssn', 'drivers_license', 'passport', 'marriage', 'divorce', 'military', 'citizenship', 'other']
      }
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
      { key: 'attorney', label: 'Attorney', type: 'person', assignRole: 'attorney' },
      {
        key: 'executorOrAgent',
        label: 'Executor / agent / trustee',
        type: 'person',
        assignRole: 'executor'
      },
      { key: 'alternate', label: 'Alternate', type: 'person' },
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
      { key: 'insured', label: 'Insured', type: 'person' },
      { key: 'owner', label: 'Policy owner', type: 'person' },
      { key: 'agent', label: 'Agent', type: 'person', assignRole: 'insurance_agent' },
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
      {
        key: 'beneficiaries',
        label: 'Beneficiaries',
        type: 'person',
        multi: true,
        assignRole: 'beneficiary'
      },
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
      { key: 'year', label: 'Year (vehicles)', type: 'text', forKinds: ['vehicle', 'boat', 'rv', 'aircraft'] },
      { key: 'make', label: 'Make', type: 'text', forKinds: ['vehicle', 'boat', 'rv', 'aircraft'] },
      { key: 'model', label: 'Model', type: 'text', forKinds: ['vehicle', 'boat', 'rv', 'aircraft'] },
      { key: 'vin', label: 'VIN / hull ID', type: 'text', forKinds: ['vehicle', 'boat', 'rv', 'aircraft'] },
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
      { key: 'hrContact', label: 'HR / contact', type: 'person', assignRole: 'employer_hr' },
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
      { key: 'preparer', label: 'CPA / preparer', type: 'person', assignRole: 'cpa' },
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
      { key: 'provider', label: 'Provider / name', type: 'person', assignRole: 'doctor' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'details', label: 'Details', type: 'textarea' },
      {
        key: 'proxyAgent',
        label: 'Proxy / agent',
        type: 'person',
        assignRole: 'healthcare_proxy'
      }
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
      { value: 'login', label: 'Provider login' },
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
      { key: 'password', label: 'Password (optional; requires vault protection)', type: 'text', sensitive: true },
      { key: 'url', label: 'URL', type: 'text' },
      { key: 'instructions', label: 'Access / recovery instructions', type: 'textarea' },
      { key: 'legacySetup', label: 'Legacy / emergency access setup', type: 'select', options: [{ value: '', label: 'Not checked' }, { value: 'configured', label: 'Configured with the provider' }, { value: 'todo', label: 'Need to set up' }, { value: 'unavailable', label: 'Provider does not offer it' }] },
      { key: 'legacyContact', label: 'Chosen legacy / emergency contact', type: 'person' },
      { key: 'recoveryLocation', label: 'Access key or recovery-material location', type: 'text' },
      { key: 'verifiedDate', label: 'Last verified with the provider', type: 'date' },
      { key: 'preference', label: 'Memorialize / delete preference', type: 'text' },
      {
        key: 'seedWarning',
        label: 'Hardware wallet / seed phrase location (never store the seed itself)',
        type: 'text'
      }
    ],
    disclaimer:
      'Logins added while filling out other sections appear here too. Passwords require vault password protection. Use recovery instructions to explain how an authorized person gains access; never store a wallet seed phrase here.'
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
      { key: 'intendedRecipient', label: 'Intended recipient', type: 'person' },
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
      { key: 'funeralHome', label: 'Funeral home', type: 'person', assignRole: 'funeral_home' },
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
      { key: 'recipient', label: 'Recipient', type: 'person' },
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
    description: 'References to important papers, where to find them, and optional uploaded copies.',
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
    showAttachments: true,
    fields: [
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'physicalLocation', label: 'Original physical location', type: 'text' },
      { key: 'electronicLocation', label: 'Electronic location', type: 'text' },
      { key: 'documentDate', label: 'Document date', type: 'date' },
      { key: 'expirationDate', label: 'Expiration date', type: 'date' }
    ],
    disclaimer:
      'Uploaded files are stored only on this computer with your vault. Include them in Everkeep backups so they travel with your vault.'
  }
]

export function getSectionDefinition(id: VaultSectionId): SectionDefinition {
  const found = SECTION_DEFINITIONS.find((section) => section.id === id)
  if (!found) throw new Error(`Unknown section: ${id}`)
  return found
}

export function getVisibleFields(def: SectionDefinition, kind: string): SectionFieldDef[] {
  return def.fields.filter((field) => !field.forKinds || field.forKinds.includes(kind))
}

export function kindLabelFor(def: SectionDefinition, kind: string | null | undefined): string {
  if (!kind) return ''
  return def.kinds?.find((item) => item.value === kind)?.label ?? kind
}

export function buildEntryTitle(options: {
  def: SectionDefinition
  kind: string
  title: string
  fields: Record<string, string>
  personName?: string | null
  fallbackFilename?: string | null
}): string {
  const trimmed = options.title.trim()
  if (trimmed) return trimmed

  const kindLabel = kindLabelFor(options.def, options.kind)
  const personName = options.personName?.trim()
  const distinguishing =
    options.fields.fullLegalName ||
    options.fields.carrier ||
    options.fields.provider ||
    options.fields.employerOrSource ||
    options.fields.description ||
    options.fallbackFilename?.replace(/\.[^.]+$/, '') ||
    ''

  if (personName && kindLabel) return `${kindLabel} — ${personName}`
  if (distinguishing && kindLabel && distinguishing !== kindLabel) {
    return `${kindLabel} — ${distinguishing}`
  }
  return distinguishing || kindLabel || 'Untitled'
}
