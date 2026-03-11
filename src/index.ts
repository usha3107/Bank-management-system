import express from 'express';
import { commandHandler } from './application/commandHandlers';
import { projections } from './application/projections';
import { eventStore } from './infrastructure/eventStore';
import * as queries from './application/queries';
import { BankAccount } from './domain/account';

const app = express();
app.use(express.json());

const port = process.env.API_PORT || 8080;


app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));


app.post('/api/accounts', async (req, res) => {
    try {
        const { accountId, ownerName, initialBalance, currency } = req.body;
        await commandHandler.createAccount(accountId, ownerName, initialBalance, currency);
        

        const events = await eventStore.getEvents(accountId);
        await projections.handleEvent(events[events.length - 1]);
        
        res.status(202).json({ message: 'Account creation accepted' });
    } catch (error: any) {
        if (error.message === 'AccountAlreadyExists') return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/accounts/:accountId/deposit', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;
        await commandHandler.depositMoney(accountId, amount, description, transactionId);
        
        const events = await eventStore.getEvents(accountId);
        await projections.handleEvent(events[events.length - 1]);
        
        res.status(202).json({ message: 'Deposit accepted' });
    } catch (error: any) {
        if (error.message === 'AccountNotFound') return res.status(404).json({ error: error.message });
        if (error.message === 'AccountClosed') return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/accounts/:accountId/withdraw', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;
        await commandHandler.withdrawMoney(accountId, amount, description, transactionId);
        
        const events = await eventStore.getEvents(accountId);
        await projections.handleEvent(events[events.length - 1]);
        
        res.status(202).json({ message: 'Withdrawal accepted' });
    } catch (error: any) {
        if (error.message === 'AccountNotFound') return res.status(404).json({ error: error.message });
        if (error.message === 'InsufficientFunds' || error.message === 'AccountClosed') return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/accounts/:accountId/close', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { reason } = req.body;
        await commandHandler.closeAccount(accountId, reason);
        
        const events = await eventStore.getEvents(accountId);
        await projections.handleEvent(events[events.length - 1]);
        
        res.status(202).json({ message: 'Account closure accepted' });
    } catch (error: any) {
        if (error.message === 'AccountNotFound') return res.status(404).json({ error: error.message });
        if (error.message === 'BalanceNotZero') return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});


app.get('/api/accounts/:accountId', async (req, res) => {
    const summary = await queries.getAccountSummary(req.params.accountId);
    if (!summary) return res.status(404).json({ error: 'Account not found' });
    res.status(200).json({
        accountId: summary.account_id,
        ownerName: summary.owner_name,
        balance: parseFloat(summary.balance),
        currency: summary.currency,
        status: summary.status
    });
});

app.get('/api/accounts/:accountId/events', async (req, res) => {
    const events = await eventStore.getEvents(req.params.accountId);
    res.status(200).json(events.map(e => ({
        eventId: e.eventId,
        eventType: e.eventType,
        eventNumber: e.eventNumber,
        data: e.eventData,
        timestamp: e.timestamp
    })));
});

app.get('/api/accounts/:accountId/transactions', async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const history = await queries.getTransactionHistory(req.params.accountId, page, pageSize);
    res.status(200).json({
        currentPage: history.currentPage,
        pageSize: history.pageSize,
        totalPages: history.totalPages,
        totalCount: history.totalCount,
        items: history.items.map(i => ({
            transactionId: i.transaction_id,
            type: i.type,
            amount: parseFloat(i.amount),
            description: i.description,
            timestamp: i.timestamp
        }))
    });
});

app.get('/api/accounts/:accountId/balance-at/:timestamp', async (req, res) => {
    try {
        const { accountId, timestamp } = req.params;
        const targetDate = new Date(decodeURIComponent(timestamp));
        

        const allEvents = await eventStore.getEvents(accountId);
        const relevantEvents = allEvents.filter(e => new Date(e.timestamp) <= targetDate);
        
        if (relevantEvents.length === 0) {
            return res.status(200).json({ accountId, balanceAt: 0, timestamp: targetDate.toISOString() });
        }

        const account = BankAccount.replay(relevantEvents);
        res.status(200).json({
            accountId,
            balanceAt: account.getState().balance,
            timestamp: targetDate.toISOString()
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});


app.post('/api/projections/rebuild', async (req, res) => {
    try {
        await projections.rebuild();
        res.status(202).json({ message: 'Projection rebuild initiated.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/projections/status', async (req, res) => {
    const status = await queries.getProjectionStatus();
    res.status(200).json(status);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
