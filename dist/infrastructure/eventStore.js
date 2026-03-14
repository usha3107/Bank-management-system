"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventStore = exports.EventStore = void 0;
const db_1 = __importDefault(require("./db"));
const uuid_1 = require("uuid");
class EventStore {
    async appendEvent(event) {
        const eventId = (0, uuid_1.v4)();
        const client = await db_1.default.connect();
        try {
            const result = await client.query(`INSERT INTO events (event_id, aggregate_id, aggregate_type, event_type, event_data, event_number)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`, [eventId, event.aggregateId, event.aggregateType, event.eventType, event.eventData, event.eventNumber]);
            return this.mapRowToEvent(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    async getEvents(aggregateId, sinceEventNumber = 0) {
        const result = await db_1.default.query('SELECT * FROM events WHERE aggregate_id = $1 AND event_number > $2 ORDER BY event_number ASC', [aggregateId, sinceEventNumber]);
        return result.rows.map((row) => this.mapRowToEvent(row));
    }
    async getAllEvents() {
        const result = await db_1.default.query('SELECT * FROM events ORDER BY timestamp ASC, event_number ASC');
        return result.rows.map(row => this.mapRowToEvent(row));
    }
    async saveSnapshot(aggregateId, state) {
        const snapshotId = (0, uuid_1.v4)();
        await db_1.default.query(`INSERT INTO snapshots (snapshot_id, aggregate_id, snapshot_data, last_event_number)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (aggregate_id) DO UPDATE
             SET snapshot_data = EXCLUDED.snapshot_data,
                 last_event_number = EXCLUDED.last_event_number,
                 created_at = NOW()`, [snapshotId, aggregateId, state, state.eventNumber]);
    }
    async getSnapshot(aggregateId) {
        const result = await db_1.default.query('SELECT * FROM snapshots WHERE aggregate_id = $1', [aggregateId]);
        if (result.rows.length === 0)
            return null;
        return {
            state: result.rows[0].snapshot_data,
            lastEventNumber: result.rows[0].last_event_number
        };
    }
    mapRowToEvent(row) {
        return {
            eventId: row.event_id,
            aggregateId: row.aggregate_id,
            aggregateType: row.aggregate_type,
            eventType: row.event_type,
            eventData: row.event_data,
            eventNumber: row.event_number,
            timestamp: row.timestamp,
            version: row.version
        };
    }
}
exports.EventStore = EventStore;
exports.eventStore = new EventStore();
