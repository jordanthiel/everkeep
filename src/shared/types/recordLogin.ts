export interface RecordLoginInput {
  id?: string
  provider: string
  username: string
  website: string
  password: string
  instructions: string
}
export interface LinkedRecord {
  id: string
  title: string
  section: string
  path: string
  archived: boolean
}
