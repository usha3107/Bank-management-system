"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projections = exports.Projections = void 0;
const db_1 = __importDefault(require("../infrastructure/db"));
class Projections {
    async handleEvent(event) {
        const client = await db_1.default.connect();
        try {
            await client.query('BEGIN');
            switch (event.eventType) {
                case 'AccountCreated':
                    await client.query(`INSERT INTO account_summaries (account_id, owner_name, balance, currency, status, version)
                         VALUES ($1, $2, $3, $4, $5, 0)
                         ON CONFLICT (account_id) DO NOTHING`, [event.eventData.accountId, event.eventData.ownerName, event.eventData.initialBalance, event.eventData.currency, 'OPEN']);
                    break;
                case 'MoneyDeposited':
                    await client.query(`UPDATE account_summaries SET balance = balance + $1, version = version + 1 WHERE account_id = $2`, [event.eventData.amount, event.aggregateId]);
                    await client.query(`INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT (transaction_id) DO NOTHING`, [event.eventData.transactionId, event.aggregateId, 'DEPOSIT', event.eventData.amount, event.eventData.description, event.timestamp]);
                    break;
                case 'MoneyWithdrawn':
                    await client.query(`UPDATE account_summaries SET balance = balance - $1, version = version + 1 WHERE account_id = $2`, [event.eventData.amount, event.aggregateId]);
                    await client.query(`INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT (transaction_id) DO NOTHING`, [event.eventData.transactionId, event.aggregateId, 'WITHDRAWAL', event.eventData.amount, event.eventData.description, event.timestamp]);
                    break;
                case 'AccountClosed':
                    await client.query(`UPDATE account_summaries SET status = $1, version = version + 1 WHERE account_id = $2`, ['CLOSED', event.aggregateId]);
                    break;
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async rebuild() {
        const client = await db_1.default.connect();
        try {
            await client.query('BEGIN');
            await client.query('TRUNCATE account_summaries CASCADE');
            await client.query('TRUNCATE transaction_history CASCADE');
            const eventsResult = await client.query('SELECT * FROM events ORDER BY timestamp ASC, event_number ASC');
            for (const row of eventsResult.rows) {
                const event = this.mapRowToEvent(row);
                await this.handleEventInRebuild(event, client);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async handleEventInRebuild(event, client) {
        switch (event.eventType) {
            case 'AccountCreated':
                await client.query(`INSERT INTO account_summaries (account_id, owner_name, balance, currency, status, version)
                     VALUES ($1, $2, $3, $4, $5, 0)`, [event.eventData.accountId, event.eventData.ownerName, event.eventData.initialBalance, event.eventData.currency, 'OPEN']);
                break;
            case 'MoneyDeposited':
                await client.query(`UPDATE account_summaries SET balance = balance + $1 WHERE account_id = $2`, [event.eventData.amount, event.aggregateId]);
                await client.query(`INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
                     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [event.eventData.transactionId, event.aggregateId, 'DEPOSIT', event.eventData.amount, event.eventData.description, event.timestamp]);
                break;
            case 'MoneyWithdrawn':
                await client.query(`UPDATE account_summaries SET balance = balance - $1 WHERE account_id = $2`, [event.eventData.amount, event.aggregateId]);
                await client.query(`INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
                     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [event.eventData.transactionId, event.aggregateId, 'WITHDRAWAL', event.eventData.amount, event.eventData.description, event.timestamp]);
                break;
            case 'AccountClosed':
                await client.query(`UPDATE account_summaries SET status = $1 WHERE account_id = $2`, ['CLOSED', event.aggregateId]);
                break;
        }
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
exports.Projections = Projections;
exports.projections = new Projections();
