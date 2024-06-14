import { desc } from 'drizzle-orm'
import { db } from '../lib/drizzle'
import { events } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'

/**
 * Insert an event ID in the database
 * @param eventId Hub event ID
 */
export async function insertEvent(eventId: number) {
    try {
        await db
            .insert(events)
            .values({ id: eventId })
            .onConflictDoNothing()
            .execute()

        log.debug(`EVENT INSERTED -- ${eventId}`)
    } catch (error) {
        log.error(error, 'ERROR INSERTING EVENT')
    }
}

/**
 * Get the latest event ID from the database
 * @returns Latest event ID
 */
export async function getLatestEvent(): Promise<number | undefined> {
    try {
        const eventArray = await db
            .select()
            .from(events)
            .orderBy(desc(events.id))
            .limit(1)

        return eventArray?.[0]?.id
    } catch (error) {
        log.error(error, 'ERROR GETTING LATEST EVENT')
        return undefined
    }
}
