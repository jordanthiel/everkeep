import type { VaultSectionId } from '../types/entry'

export type TopicId = VaultSectionId | 'people' | 'financial'
interface TopicContent {
  heading: string
  guidance: string
  action: string
  noun: string
  examples: string[]
  collection: string
  empty: string
  titleLabel: string
  titleExample?: string
  kindLabel: string
  notesLabel: string
  locationLabel?: string
  locationExample?: string
}

export const TOPIC_CONTENT: Record<TopicId, TopicContent> = {
  people: {
    heading: 'Introduce someone your family can turn to', guidance: 'Start with how to reach this person, then choose any responsibilities they already have. You can select them again when adding accounts, care plans, or documents.', action: 'Add a trusted contact', noun: 'contact', examples: ['Family and close friends', 'An executor or trustee', 'Your attorney or adviser'], collection: 'Your family and trusted contacts', empty: 'Start with yourself or the person your family should call first.', titleLabel: 'Full name', kindLabel: 'Relationship', notesLabel: 'What should your family know about this person?'
  },
  financial: {
    heading: 'Put an account on your family’s radar', guidance: 'Name the bank or institution, identify the account, and record its owners. Add the beneficiaries already recorded with the institution; balances are optional.', action: 'Add a financial account', noun: 'account', examples: ['Everyday checking and savings', 'Retirement accounts', 'Investment accounts'], collection: 'Accounts your family should know about', empty: 'Start with the bank account you use most often, then add savings and investments.', titleLabel: 'Account name', kindLabel: 'Account type', notesLabel: 'Instructions for finding or handling this account'
  },
  identity: {
    heading: 'Make an important ID easy to locate', guidance: 'Choose whose ID this is, then the document type. Record the identifying details you want to keep and where the original can be found.', action: 'Add an ID or personal document', noun: 'ID details', examples: ['A passport and its expiry date', 'A driver license', 'A birth or marriage document'], collection: 'Personal documents by contact', empty: 'Add a contact first, then record their passport, license, or other ID.', titleLabel: 'Document name', kindLabel: 'Which personal document?', notesLabel: 'Anything else about this document?', locationLabel: 'Where is the original ID or document?', locationExample: 'Passport wallet in the home safe'
  },
  legal: {
    heading: 'Point your family to the legal arrangements in place', guidance: 'Record whether the document exists, who is named to act, and who holds the signed original. This is a guide to existing arrangements, not a way to create or change a legal document.', action: 'Locate a legal document', noun: 'legal document details', examples: ['A signed will', 'A trust and its trustee', 'A power of attorney'], collection: 'Your legal documents and arrangements', empty: 'Start with your will or a document your attorney helped prepare. You can also note that something is not yet in place.', titleLabel: 'Document or arrangement name', kindLabel: 'Which legal arrangement?', notesLabel: 'Instructions for locating or discussing this arrangement', locationLabel: 'Where is the signed original?', locationExample: 'Original held by our estate attorney; copy in the blue folder'
  },
  dependents: {
    heading: 'Help someone step into a caring role', guidance: 'Choose a child, dependent adult, or pet. Leave the routine, trusted caregivers, and immediate needs someone would need to keep their day running smoothly.', action: 'Create a care profile', noun: 'care profile', examples: ['School pickup and bedtime', 'Support and communication needs', 'Feeding, walks, and vet contacts'], collection: 'The people and pets who depend on you', empty: 'Create a profile for each person or pet whose care you coordinate.', titleLabel: 'Name', kindLabel: 'Who are you planning care for?', notesLabel: 'What helps them feel comfortable and supported?'
  },
  debts: {
    heading: 'Make an important payment easy to understand', guidance: 'Identify the provider, who is named on the account, and how payments are made. Leave instructions about whom to ask before changing or stopping a payment.', action: 'Add a bill or debt', noun: 'payment details', examples: ['The home mortgage', 'A credit card', 'A recurring utility bill'], collection: 'Bills and debts to keep track of', empty: 'Start with a payment that keeps the household running, such as the mortgage or electricity bill.', titleLabel: 'Bill or debt name', kindLabel: 'What kind of payment is this?', notesLabel: 'What should someone check before changing this payment?'
  },
  insurance: {
    heading: 'Help your family find the right coverage', guidance: 'Identify the policy, who or what it covers, and how to contact the insurer. Add policy numbers and beneficiary information when you have them nearby.', action: 'Add an insurance policy', noun: 'policy', examples: ['Life insurance', 'Home or auto coverage', 'Long-term care coverage'], collection: 'Your insurance policies', empty: 'Add the insurer and policy your family is most likely to need first.', titleLabel: 'Policy name', kindLabel: 'What does this policy cover?', notesLabel: 'Instructions for contacting the insurer or making a claim', locationLabel: 'Where are the policy documents?', locationExample: 'Insurance folder in the study; copies in the insurer’s portal'
  },
  property: {
    heading: 'Leave a useful guide to a home or vehicle', guidance: 'Describe the property, its ownership, and how to find the title, keys, or related paperwork. Choosing a vehicle reveals the relevant vehicle details.', action: 'Add a property or vehicle', noun: 'property details', examples: ['Your home', 'A car and its title', 'A rental property'], collection: 'Homes, vehicles, and other property', empty: 'Start with your home or the vehicle someone would need to look after.', titleLabel: 'Property or vehicle name', kindLabel: 'What kind of property?', notesLabel: 'Access, maintenance, or ownership instructions', locationLabel: 'Where are the title, deed, or keys?', locationExample: 'Deed in the home safe; spare keys with Jamie'
  },
  income: {
    heading: 'Identify a source of household income', guidance: 'Name the employer or income source, the person receiving it, and the contact who can explain benefits or payments. Add practical next steps for the person helping.', action: 'Add an income source', noun: 'income source', examples: ['An employer and HR contact', 'A pension', 'Recurring benefits'], collection: 'Employment, benefits, and income', empty: 'Start with your main employer, pension, or regular benefit payment.', titleLabel: 'Employer or income source', kindLabel: 'Where does this income come from?', notesLabel: 'Who should be contacted about payments or benefits?', locationLabel: 'Where are employment or benefit documents?', locationExample: 'Benefits folder and employee portal'
  },
  taxes: {
    heading: 'Leave a trail to your tax paperwork', guidance: 'Record the return, tax contact, or other tax information someone may need. Include the relevant year and where to find the paperwork.', action: 'Add tax information', noun: 'tax information', examples: ['Your tax preparer', 'Last year’s return', 'Property tax information'], collection: 'Tax contacts and paperwork', empty: 'Start with your tax preparer or the location of your most recent return.', titleLabel: 'Tax document or contact name', kindLabel: 'What tax information are you adding?', notesLabel: 'Instructions for the preparer or person helping', locationLabel: 'Where are the tax records?', locationExample: '2025 tax folder in the filing cabinet'
  },
  healthcare: {
    heading: 'Give someone the context to help with your care', guidance: 'Choose a care contact, medication, condition, or care document. Record the details someone would need to discuss it with your care team.', action: 'Add care information', noun: 'care information', examples: ['Your primary care clinician', 'A medication or allergy', 'An advance directive'], collection: 'Your care team and health information', empty: 'Start with the clinician who knows your care best, or an important medication or allergy.', titleLabel: 'Care contact, medication, or document name', kindLabel: 'What would help someone with your care?', notesLabel: 'What should the care team or person helping know?', locationLabel: 'Where are related care documents?', locationExample: 'Healthcare folder beside the medication list'
  },
  digital: {
    heading: 'Leave a route to authorized digital access', guidance: 'Identify the service and describe how an authorized person can obtain access. Record legacy-contact or recovery arrangements and where you keep the supporting instructions.', action: 'Add a digital account', noun: 'digital access instructions', examples: ['Your password manager', 'Your main email account', 'Apple or Google legacy arrangements'], collection: 'Digital accounts and access plans', empty: 'Start with your password manager or main email account—the starting point for many other services.', titleLabel: 'Service or account name', kindLabel: 'Which part of your digital life?', notesLabel: 'Instructions for authorized access or account handling', locationLabel: 'Where are the recovery instructions?', locationExample: 'Sealed recovery instructions in the home safe'
  },
  household: {
    heading: 'Explain something that keeps the home running', guidance: 'Identify the service or household responsibility, who handles it, and what someone needs to do. Include practical access or contact instructions.', action: 'Add household instructions', noun: 'household instructions', examples: ['An alarm and its support contact', 'A regular home service', 'A subscription to review'], collection: 'The household details someone should know', empty: 'Start with a household task or service that usually only you handle.', titleLabel: 'Service or household responsibility', kindLabel: 'What needs looking after?', notesLabel: 'What should someone do, and when?', locationLabel: 'Where are the related instructions or supplies?', locationExample: 'Service folder in the kitchen drawer'
  },
  'personal-property': {
    heading: 'Tell the story of a meaningful belonging', guidance: 'Describe the item, where it is, and any person you hope will receive it. Add the story or care instructions that make it more than an inventory entry.', action: 'Add a meaningful belonging', noun: 'belonging', examples: ['An heirloom with a family story', 'A collection', 'Jewelry or artwork'], collection: 'Meaningful belongings and their stories', empty: 'Start with an item whose history or intended recipient you want your family to know.', titleLabel: 'What is the item?', kindLabel: 'What kind of belonging?', notesLabel: 'Its story, meaning, or special care instructions', locationLabel: 'Where can someone find the item?', locationExample: 'Grandmother’s ring in the small jewelry box'
  },
  'final-wishes': {
    heading: 'Share a preference in your own words', guidance: 'Choose the part of your farewell you want to describe. Leave as much detail as feels right, including any arrangements you have already discussed or made.', action: 'Record a wish or preference', noun: 'wish', examples: ['A ceremony or gathering', 'Music and readings', 'An existing funeral arrangement'], collection: 'The wishes you’ve chosen to share', empty: 'You can begin with one small preference. There is no need to decide everything at once.', titleLabel: 'Name this wish or arrangement', kindLabel: 'What would you like to share?', notesLabel: 'What matters most to you about this?', locationLabel: 'Where are any related arrangements documented?', locationExample: 'Prearrangement paperwork in the final wishes folder'
  },
  letters: {
    heading: 'Write something only you can say', guidance: 'Choose the person you are writing to, give the message a name, and write in your own voice. Private letters stay out of exported packets unless you explicitly select them.', action: 'Write a letter or message', noun: 'letter', examples: ['A message to your partner', 'Words for your children', 'Personal guidance for your executor'], collection: 'Your letters and personal messages', empty: 'Choose someone you would like to write to. A few sincere sentences are enough to begin.', titleLabel: 'Give your message a name', kindLabel: 'Who is this message for?', notesLabel: 'When or how should this message be shared?'
  },
  documents: {
    heading: 'Give an important paper a place in the plan', guidance: 'Name the document and note where the original is kept. You can attach a copy to keep with your vault, or simply record its location.', action: 'Add a document or its location', noun: 'document', examples: ['A certificate or agreement', 'A scanned copy of a paper', 'Directions to an original document'], collection: 'Other important documents', empty: 'Add a paper your family would otherwise have to search for. You do not need to duplicate documents already listed in another topic.', titleLabel: 'Document name', kindLabel: 'What kind of document?', notesLabel: 'What is this document needed for?', locationLabel: 'Where is the original document?', locationExample: 'Labeled folder in the study cabinet'
  }
}

export function entryFormContent(id: VaultSectionId, kind: string, kindLabel?: string) {
  const content = TOPIC_CONTENT[id]
  if (id === 'digital' && kind === 'login') return { ...content, heading: 'Keep this provider’s login handy', noun: 'provider login', guidance: 'Save the sign-in details and explain any verification or recovery steps. This is the same login shown on its linked policies, accounts, or other records.' }
  if (id === 'dependents') {
    const care = {
      child: { heading: 'Plan a child’s day with someone they trust', guidance: 'Include school pickup, familiar routines, and who can step in. Note comfort items and the details a temporary caregiver would need first.', titleLabel: 'Child’s name', titleExample: 'e.g. Sam' },
      adult: { heading: 'Make a dependent adult’s support needs clear', guidance: 'Describe daily support, communication preferences, and trusted helpers. Include what supports their comfort, dignity, and independence.', titleLabel: 'Person’s name', titleExample: 'e.g. Alex' },
      pet: { heading: 'Make sure your pet’s routine stays familiar', guidance: 'Leave feeding and walking routines, care needs, and vet details. Name someone who knows your pet and where they can find food and supplies.', titleLabel: 'Pet’s name', titleExample: 'e.g. Scout' }
    }[kind]
    return { ...content, ...care }
  }
  if (id === 'letters') return { ...content, heading: 'Write your message', titleExample: kind === 'business' ? 'Keeping the business running' : 'A few things I want you to know', noun: kind === 'business' ? 'instructions' : 'letter' }
  if (id === 'healthcare') {
    const examples: Record<string, string> = {doctor: 'Primary care clinician', medication: 'Name of the medication', allergy: 'Name of the allergen', pharmacy: 'Usual pharmacy', condition: 'Name of the condition', directive: 'My healthcare directive'}
    return {...content, heading: kindLabel ? `${kindLabel} details` : content.heading, titleExample: examples[kind] ?? 'Name this care information'}
  }
  return { ...content, heading: kindLabel && kind !== 'other' ? `${kindLabel} details` : content.heading }
}

export function topicFieldPresentation(id: VaultSectionId, key: string, kind: string): {label?: string; placeholder?: string} {
  if (id === 'dependents') {
    if (key === 'routine') return {label: kind === 'pet' ? 'Feeding, walks, and daily routine' : 'A typical day and what they need', placeholder: kind === 'pet' ? 'Food and portions, usual walk times, where they sleep…' : 'Morning routine, meals, activities, and bedtime…'}
    if (key === 'careNeeds') return {placeholder: 'Important allergies, regular medications, and whom to call with questions…'}
    if (key === 'school') return {placeholder: 'School name, pickup time, authorized pickup people, and contact number…'}
    if (key === 'supplies') return {placeholder: kind === 'pet' ? 'Food in the pantry; leash by the door; carrier in the hall closet…' : 'Where to find clothing, care supplies, and favorite comfort items…'}
  }
  if (id === 'legal' && key === 'exists') return {label: 'Is this arrangement already in place?'}
  if (id === 'letters' && key === 'body') return {label: 'Your message', placeholder: 'Start with what you’d like this person to know. A memory, some encouragement, or a few practical words are enough.'}
  if (id === 'letters' && key === 'privateFlag') return {label: 'Should this message be treated as private?'}
  if (id === 'healthcare' && key === 'details') {
    if (kind === 'medication') return {label: 'Medication instructions to discuss with the care team', placeholder: 'Name, strength, usual schedule, prescribing clinician, and where the current medication list is kept…'}
    if (kind === 'allergy') return {label: 'Allergy and known reaction', placeholder: 'What causes the reaction, what has happened before, and where to find care-team instructions…'}
    if (kind === 'doctor') return {label: 'How this clinician helps with your care', placeholder: 'Specialty, clinic, and what someone should contact them about…'}
  }
  return {}
}
