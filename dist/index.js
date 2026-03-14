"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const commandHandlers_1 = require("./application/commandHandlers");
const projections_1 = require("./application/projections");
const eventStore_1 = require("./infrastructure/eventStore");
const queries = __importStar(require("./application/queries"));
const account_1 = require("./domain/account");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const port = process.env.API_PORT || 8080;
app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));
app.post('/api/accounts', async (req, res) => {
    try {
        const { accountId, ownerName, initialBalance, currency } = req.body;
        await commandHandlers_1.commandHandler.createAccount(accountId, ownerName, initialBalance, currency);
        const events = await eventStore_1.eventStore.getEvents(accountId);
        await projections_1.projections.handleEvent(events[events.length - 1]);
        res.status(202).json({ message: 'Account creation accepted' });
    }
    catch (error) {
        if (error.message === 'AccountAlreadyExists')
            return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});
app.post('/api/accounts/:accountId/deposit', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;
        await commandHandlers_1.commandHandler.depositMoney(accountId, amount, description, transactionId);
        const events = await eventStore_1.eventStore.getEvents(accountId);
        await projections_1.projections.handleEvent(events[events.length - 1]);
        res.status(202).json({ message: 'Deposit accepted' });
    }
    catch (error) {
        if (error.message === 'AccountNotFound')
            return res.status(404).json({ error: error.message });
        if (error.message === 'AccountClosed')
            return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});
app.post('/api/accounts/:accountId/withdraw', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;
        await commandHandlers_1.commandHandler.withdrawMoney(accountId, amount, description, transactionId);
        const events = await eventStore_1.eventStore.getEvents(accountId);
        await projections_1.projections.handleEvent(events[events.length - 1]);
        res.status(202).json({ message: 'Withdrawal accepted' });
    }
    catch (error) {
        if (error.message === 'AccountNotFound')
            return res.status(404).json({ error: error.message });
        if (error.message === 'InsufficientFunds' || error.message === 'AccountClosed')
            return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});
app.post('/api/accounts/:accountId/close', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { reason } = req.body;
        await commandHandlers_1.commandHandler.closeAccount(accountId, reason);
        const events = await eventStore_1.eventStore.getEvents(accountId);
        await projections_1.projections.handleEvent(events[events.length - 1]);
        res.status(202).json({ message: 'Account closure accepted' });
    }
    catch (error) {
        if (error.message === 'AccountNotFound')
            return res.status(404).json({ error: error.message });
        if (error.message === 'BalanceNotZero')
            return res.status(409).json({ error: error.message });
        res.status(400).json({ error: error.message });
    }
});
app.get('/api/accounts/:accountId', async (req, res) => {
    const summary = await queries.getAccountSummary(req.params.accountId);
    if (!summary)
        return res.status(404).json({ error: 'Account not found' });
    res.status(200).json({
        accountId: summary.account_id,
        ownerName: summary.owner_name,
        balance: parseFloat(summary.balance),
        currency: summary.currency,
        status: summary.status
    });
});
app.get('/api/accounts/:accountId/events', async (req, res) => {
    const events = await eventStore_1.eventStore.getEvents(req.params.accountId);
    res.status(200).json(events.map(e => ({
        eventId: e.eventId,
        eventType: e.eventType,
        eventNumber: e.eventNumber,
        data: e.eventData,
        timestamp: e.timestamp
    })));
});
app.get('/api/accounts/:accountId/transactions', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
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
        const allEvents = await eventStore_1.eventStore.getEvents(accountId);
        const relevantEvents = allEvents.filter(e => new Date(e.timestamp) <= targetDate);
        if (relevantEvents.length === 0) {
            return res.status(200).json({ accountId, balanceAt: 0, timestamp: targetDate.toISOString() });
        }
        const account = account_1.BankAccount.replay(relevantEvents);
        res.status(200).json({
            accountId,
            balanceAt: account.getState().balance,
            timestamp: targetDate.toISOString()
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
app.post('/api/projections/rebuild', async (req, res) => {
    try {
        await projections_1.projections.rebuild();
        res.status(202).json({ message: 'Projection rebuild initiated.' });
    }
    catch (error) {
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
