import pool from '../infrastructure/db';

export async function getAccountSummary(accountId: string) {
    const result = await pool.query('SELECT * FROM account_summaries WHERE account_id = $1', [accountId]);
    return result.rows[0];
}

export async function getTransactionHistory(accountId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
        'SELECT * FROM transaction_history WHERE account_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
        [accountId, pageSize, offset]
    );
    const countResult = await pool.query('SELECT COUNT(*) FROM transaction_history WHERE account_id = $1', [accountId]);
    return {
        items: result.rows,
        totalCount: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / pageSize),
        currentPage: page,
        pageSize
    };
}

export async function getProjectionStatus() {
    const totalResult = await pool.query('SELECT COUNT(*) FROM events');
    const totalEvents = parseInt(totalResult.rows[0].count);

    const summariesResult = await pool.query('SELECT MAX(version) FROM account_summaries');
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
