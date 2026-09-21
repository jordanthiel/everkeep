import type { Database, Statement } from './ports.ts'
export interface SqlExecutor { unsafe(query: string, parameters?: never[]): PromiseLike<Record<string, unknown>[] & { count: number }> }
export interface TransactionalSql extends SqlExecutor { begin<T>(callback: (sql: SqlExecutor) => Promise<T>): Promise<T> }
// Convert portable query parameters to Postgres positional parameters.
export function postgresQuery(query: string) {
  let index = 0
  return query.replace(/\?/g, () => `$${++index}`)
}
export function createPostgresDatabase(sql: TransactionalSql): Database {
  class Query implements Statement {
    constructor(readonly text: string, readonly values: unknown[] = []) {}
    bind(...values: unknown[]) { return new Query(this.text, values) }
    execute(connection: SqlExecutor = sql) { return connection.unsafe(postgresQuery(this.text), this.values as never[]) }
    async first<T>() { return (await this.execute())[0] as T ?? null }
    async all<T>() { return { results: [...await this.execute()] as T[] } }
    async run() { return { meta: { changes: (await this.execute()).count } } }
  }
  return { prepare: text => new Query(text), batch: statements => sql.begin(async transaction => { const results = []; for (const statement of statements) results.push(await (statement as Query).execute(transaction)); return results }) }
}
