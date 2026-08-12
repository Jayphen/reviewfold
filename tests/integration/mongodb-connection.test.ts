import { afterAll, describe, expect, it } from 'vitest'

import {
  closeMongoClient,
  getMongoClient,
  getMongoDatabase,
  startMongoSession,
} from '#/server/platform/mongodb/client.server'

const describeWithMongoDb =
  process.env.RUN_MONGODB_INTEGRATION === '1' ? describe : describe.skip

describeWithMongoDb('local MongoDB replica set', () => {
  afterAll(async () => {
    await closeMongoClient()
  })

  it('connects to the primary and reuses the client', async () => {
    const firstClient = await getMongoClient()
    const secondClient = await getMongoClient()
    const database = await getMongoDatabase()
    const hello = await database.admin().command({ hello: 1 })

    expect(secondClient).toBe(firstClient)
    expect(hello).toMatchObject({
      isWritablePrimary: true,
      setName: 'rs0',
    })
  })

  it('can create and cleanly end a session', async () => {
    const session = await startMongoSession()

    expect(session.hasEnded).toBe(false)
    await session.endSession()
    expect(session.hasEnded).toBe(true)
  })
})
