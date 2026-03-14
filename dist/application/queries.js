"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountSummary = getAccountSummary;
exports.getTransactionHistory = getTransactionHistory;
exports.getProjectionStatus = getProjectionStatus;
const db_1 = __importDefault(require("../infrastructure/db"));
async function getAccountSummary(accountId) {
    const result = await db_1.default.query('SELECT * FROM account_summaries WHERE account_id = $1', [accountId]);
    return result.rows[0];
}
async function getTransactionHistory(accountId, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await db_1.default.query('SELECT * FROM transaction_history WHERE account_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3', [accountId, pageSize, offset]);
    const countResult = await db_1.default.query('SELECT COUNT(*) FROM transaction_history WHERE account_id = $1', [accountId]);
    return {
        items: result.rows,
        totalCount: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / pageSize),
        currentPage: page,
        pageSize
    };
}
async function getProjectionStatus() {
    const totalResult = await db_1.default.query('SELECT COUNT(*) FROM events');
    const totalEvents = parseInt(totalResult.rows[0].count);
    const summariesResult = await db_1.default.query('SELECT MAX(version) FROM account_summaries');
    const summariesVersion = parseInt(summariesResult.rows[0].max || '0');
    return {
        totalEventsInStore: totalEvents,
        projections: [
            {
                name: "AccountSummaries",
                lastProcessedEventNumberGlobal: totalEvents, // Simulated for this simple synchronous impl
                lag: 0
            },
            {
                name: "TransactionHistory",
                lastProcessedEventNumberGlobal: totalEvents,
                lag: 0
            }
        ]
    };
}
