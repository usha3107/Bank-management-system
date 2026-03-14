import pool from './db';
import { BankAccountEvent } from '../domain/events';
import { BankAccountState } from '../domain/account';
import { v4 as uuidv4 } from 'uuid';

export class EventStore {
    async appendEvent(event: Omit<BankAccountEvent, 'eventId' | 'timestamp' | 'version'>): Promise<BankAccountEvent> {
        const eventId = uuidv4();
        const client = await pool.connect();
        try {
            const result = await client.query(
                `INSERT INTO events (event_id, aggregate_id, aggregate_type, event_type, event_data, event_number)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [eventId, event.aggregateId, event.aggregateType, event.eventType, event.eventData, event.eventNumber]
            );
            return this.mapRowToEvent(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async getEvents(aggregateId: string, sinceEventNumber: number = 0): Promise<BankAccountEvent[]> {
        const result = await pool.query(
            'SELECT * FROM events WHERE aggregate_id = $1 AND event_number > $2 ORDER BY event_number ASC',
            [aggregateId, sinceEventNumber]
        );
        return result.rows.map(row: any => this.mapRowToEvent(row));
    }

    async getAllEvents(): Promise<BankAccountEvent[]> {
        const result = await pool.query('SELECT * FROM events ORDER BY timestamp ASC, event_number ASC');
        return result.rows.map(row => this.mapRowToEvent(row));
    }

    async saveSnapshot(aggregateId: string, state: BankAccountState): Promise<void> {
        const snapshotId = uuidv4();
        await pool.query(
            `INSERT INTO snapshots (snapshot_id, aggregate_id, snapshot_data, last_event_number)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (aggregate_id) DO UPDATE
             SET snapshot_data = EXCLUDED.snapshot_data,
                 last_event_number = EXCLUDED.last_event_number,
                 created_at = NOW()`,
            [snapshotId, aggregateId, state, state.eventNumber]
        );
    }

    async getSnapshot(aggregateId: string): Promise<{ state: BankAccountState; lastEventNumber: number } | null> {
        const result = await pool.query(
            'SELECT * FROM snapshots WHERE aggregate_id = $1',
            [aggregateId]
        );
        if (result.rows.length === 0) return null;
        return {
            state: result.rows[0].snapshot_data,
            lastEventNumber: result.rows[0].last_event_number
        };
    }

    private mapRowToEvent(row: any): BankAccountEvent {
        return {
            eventId: row.event_id,
            aggregateId: row.aggregate_id,
            aggregateType: row.aggregate_type,
            eventType: row.event_type,
            eventData: row.event_data,
            eventNumber: row.event_number,
            timestamp: row.timestamp,
            version: row.version
        } as BankAccountEvent;
    }
}

export const eventStore = new EventStore();
