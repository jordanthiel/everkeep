import type { Migration } from './types'

export const migration001: Migration = {
  id: '001_initial_schema',
  version: 1,
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY NOT NULL,
        version INTEGER NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vault_metadata (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        household_name TEXT,
        owner_first_name TEXT,
        owner_middle_name TEXT,
        owner_last_name TEXT,
        owner_preferred_name TEXT,
        owner_date_of_birth TEXT,
        spouse_partner_name TEXT,
        schema_version INTEGER NOT NULL,
        is_password_protected INTEGER NOT NULL DEFAULT 0,
        password_verifier TEXT,
        encryption_salt TEXT,
        encryption_params TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        relationship TEXT,
        date_of_birth TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS person_roles (
        id TEXT PRIMARY KEY NOT NULL,
        person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(person_id, role)
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        address_or_path TEXT,
        access_instructions TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        company TEXT,
        role TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        website TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        institution TEXT NOT NULL,
        account_name TEXT,
        account_type TEXT NOT NULL,
        last_four TEXT,
        full_account_number_encrypted TEXT,
        approximate_value REAL,
        transfer_on_death INTEGER DEFAULT 0,
        contact_info TEXT,
        website TEXT,
        statement_location_id TEXT REFERENCES locations(id),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS account_owners (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        UNIQUE(account_id, person_id)
      );

      CREATE TABLE IF NOT EXISTS beneficiary_designations (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        designation_type TEXT NOT NULL CHECK(designation_type IN ('primary', 'contingent')),
        percentage REAL NOT NULL,
        per_stirpes INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS insurance_policies (
        id TEXT PRIMARY KEY NOT NULL,
        policy_type TEXT NOT NULL,
        carrier TEXT,
        policy_number TEXT,
        insured_person_id TEXT REFERENCES people(id),
        owner_person_id TEXT REFERENCES people(id),
        agent_contact_id TEXT REFERENCES contacts(id),
        coverage_amount REAL,
        term_or_permanent TEXT,
        premium REAL,
        payment_source TEXT,
        policy_location_id TEXT REFERENCES locations(id),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY NOT NULL,
        property_name TEXT NOT NULL,
        address TEXT,
        ownership TEXT,
        purchase_date TEXT,
        title_deed_location_id TEXT REFERENCES locations(id),
        access_instructions TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY NOT NULL,
        year INTEGER,
        make TEXT,
        model TEXT,
        vin TEXT,
        owner_person_id TEXT REFERENCES people(id),
        title_location_id TEXT REFERENCES locations(id),
        keys_location_id TEXT REFERENCES locations(id),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS legal_documents (
        id TEXT PRIMARY KEY NOT NULL,
        document_type TEXT NOT NULL,
        exists_flag INTEGER,
        date_signed TEXT,
        attorney_contact_id TEXT REFERENCES contacts(id),
        executor_person_id TEXT REFERENCES people(id),
        alternate_executor_person_id TEXT REFERENCES people(id),
        original_location_id TEXT REFERENCES locations(id),
        copy_location_id TEXT REFERENCES locations(id),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS trusts (
        id TEXT PRIMARY KEY NOT NULL,
        trust_name TEXT NOT NULL,
        trust_type TEXT,
        date_created TEXT,
        grantor_person_id TEXT REFERENCES people(id),
        trustee_person_id TEXT REFERENCES people(id),
        successor_trustee_person_id TEXT REFERENCES people(id),
        attorney_contact_id TEXT REFERENCES contacts(id),
        tax_id_encrypted TEXT,
        original_location_id TEXT REFERENCES locations(id),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS digital_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        provider TEXT,
        account_identifier TEXT,
        url TEXT,
        instructions TEXT,
        preference TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        original_physical_location_id TEXT REFERENCES locations(id),
        electronic_location TEXT,
        attachment_id TEXT,
        document_date TEXT,
        expiration_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS final_wishes (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        preference TEXT,
        details_json TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        storage_path TEXT NOT NULL,
        checksum TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_people_archived ON people(archived_at);
      CREATE INDEX IF NOT EXISTS idx_accounts_archived ON accounts(archived_at);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_beneficiary_account ON beneficiary_designations(account_id);
    `)
  }
}
