import { eq } from 'drizzle-orm'
import { REDIS_URL } from '../env.ts'
import { db } from '../lib/drizzle'
import { userData } from '../lib/drizzle/schema.ts'
import { RedisClient, getRedisClient } from '../shuttle'

const POWER_BADGE_CACHE_PREFIX = 'warpcast:power-badge'

const reviver = (_k: string, v: any): any => {
    if (typeof v === 'string') {
        // Check for date string and convert to Date object
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(v)) {
            return new Date(v)
        }
    } else if (v !== null && typeof v === 'object') {
        // If it's an object (but not null), iterate over its properties
        for (const innerKey of Object.keys(v)) {
            v[innerKey] = reviver(innerKey, v[innerKey])
        }
    } else if (Array.isArray(v)) {
        // If it's an array, iterate over its elements
        return v.map((item, index) => reviver(String(index), item))
    }
    return v
}

// biome-ignore lint/suspicious/noExplicitAny: generic replacer
const replacer = (_key: string, value: any) => {
    if (typeof value === 'bigint') {
        // Check if the value is a BigInt
        return value.toString() // Convert BigInt to string
    }
    return value // Return the value unchanged if not a BigInt
}

export const run = async () => {
    console.log('Fetching power badge users...')
    const redisClient = getRedisClient({ redisUrl: REDIS_URL })
    const client = new RedisClient(redisClient)

    const response = await fetch(
        'https://api.warpcast.com/v2/power-badge-users',
    )
    console.log('response:', response)

    if (!response.ok) {
        throw new Error(response.statusText)
    }

    const res = (await response.json()) as { result: { fids: number[] } }

    const {
        result: { fids },
    } = res

    console.log('fids:', fids)

    if (!fids || fids.length === 0) {
        throw new Error('No fids found')
    }
    console.log(`Found ${fids.length} power badge users`)

    const newPowerBadgeUsers = fids.map((fid: number) => fid.toString())
    console.log('newPowerBadgeUsers:', newPowerBadgeUsers)

    let oldPowerBadgeUsers: string[] = []
    try {
        const json = await client.client.get(POWER_BADGE_CACHE_PREFIX)
        console.log('json:', json)
        if (json) {
            oldPowerBadgeUsers = JSON.parse(json, reviver)
        }
    } catch (error) {
        throw new Error(
            `Failed to parse JSON for ${POWER_BADGE_CACHE_PREFIX}: ${error}`,
        )
    }

    console.log('oldPowerBadgeUsers:', oldPowerBadgeUsers)

    if (oldPowerBadgeUsers && oldPowerBadgeUsers.length > 0) {
        const addDelta = newPowerBadgeUsers.filter(
            (fid) => !oldPowerBadgeUsers.includes(fid),
        )
        console.log('addDelta:', addDelta)

        // set power badge users in the db
        await db.transaction(async (trx) => {
            addDelta.map(async (fid) => {
                await trx
                    .update(userData)
                    .set({ powerBadge: true })
                    .where(eq(userData.fid, fid))
            })
        })

        const removeDelta = oldPowerBadgeUsers.filter(
            (fid) => !newPowerBadgeUsers.includes(fid),
        )
        console.log('removeDelta:', removeDelta)

        // remove power badge users in the db
        await db.transaction(async (trx) => {
            removeDelta.map(async (fid) => {
                await trx
                    .update(userData)
                    .set({ powerBadge: false })
                    .where(eq(userData.fid, fid))
            })
        })
    } else {
        console.log('No old power badge users found')
        // set all power badge users in the db
        await db.transaction(async (trx) => {
            newPowerBadgeUsers.map(async (fid) => {
                await trx
                    .update(userData)
                    .set({ powerBadge: true })
                    .where(eq(userData.fid, fid))
            })
        })
    }
    console.log('Power badge users updated in the database')

    await client.client.set(
        POWER_BADGE_CACHE_PREFIX,
        JSON.stringify(newPowerBadgeUsers, replacer),
    )

    console.log(`Added ${newPowerBadgeUsers.length} new power badge users`)
}

run()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => {
        process.exit(0)
    })
