/* global print, rs */

const expectedName = 'rs0'
const expectedMember = '127.0.0.1:27017'

let replicaSetConfig

try {
  replicaSetConfig = rs.conf()
} catch (error) {
  if (error.code !== 94 && error.codeName !== 'NotYetInitialized') {
    throw error
  }

  const result = rs.initiate({
    _id: expectedName,
    members: [{ _id: 0, host: expectedMember }],
  })

  if (result.ok !== 1) {
    throw new Error(
      `Replica-set initialization failed: ${JSON.stringify(result)}`,
      { cause: error },
    )
  }

  print('Replica set initialized.')
}

if (replicaSetConfig) {
  const configuredMember = replicaSetConfig.members.find(({ _id }) => _id === 0)

  if (
    replicaSetConfig._id !== expectedName ||
    replicaSetConfig.members.length !== 1 ||
    configuredMember?.host !== expectedMember
  ) {
    throw new Error(
      'The existing replica-set configuration does not match the local ' +
        'Reviewfold setup. Run pnpm db:reset to recreate the development volume.',
    )
  }

  print('Replica set is already initialized.')
}
