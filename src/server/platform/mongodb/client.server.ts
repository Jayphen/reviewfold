import '@tanstack/react-start/server-only'

import {
  MongoClient,
  type ClientSession,
  type ClientSessionOptions,
  type Db,
  type TransactionOptions,
} from 'mongodb'

import { getServerEnvironment } from '#/server/platform/environment/environment.server'

const applicationName = 'reviewfold'

let mongoClientPromise: Promise<MongoClient> | undefined
let activeMongoClient: MongoClient | undefined

function connectMongoClient(): Promise<MongoClient> {
  const { uri } = getServerEnvironment().mongodb
  const client = new MongoClient(uri, { appName: applicationName })
  activeMongoClient = client

  return client.connect().catch(async (error: unknown) => {
    if (activeMongoClient === client) {
      activeMongoClient = undefined
      mongoClientPromise = undefined
    }

    await client.close()
    throw error
  })
}

export function getMongoClient(): Promise<MongoClient> {
  mongoClientPromise ??= connectMongoClient()
  return mongoClientPromise
}

export async function getMongoDatabase(): Promise<Db> {
  const client = await getMongoClient()
  const { databaseName } = getServerEnvironment().mongodb

  return client.db(databaseName)
}

export async function startMongoSession(
  options?: ClientSessionOptions,
): Promise<ClientSession> {
  const client = await getMongoClient()

  return client.startSession(options)
}

export interface MongoTransactionContext {
  database: Db
  session: ClientSession
}

/**
 * Runs a unit of work with the driver's transaction retry behavior. The
 * operation may run more than once and must pass the supplied session to every
 * MongoDB call that belongs to the transaction.
 */
export async function withMongoTransaction<Result>(
  operation: (context: MongoTransactionContext) => Promise<Result>,
  options?: TransactionOptions,
): Promise<Result> {
  const client = await getMongoClient()
  const { databaseName } = getServerEnvironment().mongodb
  const database = client.db(databaseName)
  const session = client.startSession()

  try {
    return await session.withTransaction(
      async () => operation({ database, session }),
      options,
    )
  } finally {
    await session.endSession()
  }
}

export async function closeMongoClient(): Promise<void> {
  const connectionPromise = mongoClientPromise
  const client = activeMongoClient
  mongoClientPromise = undefined
  activeMongoClient = undefined

  if (!connectionPromise || !client) {
    return
  }

  await connectionPromise.catch(() => undefined)
  await client.close()
}
