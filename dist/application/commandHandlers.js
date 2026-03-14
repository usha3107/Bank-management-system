"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandHandler = exports.CommandHandler = void 0;
const eventStore_1 = require("../infrastructure/eventStore");
const account_1 = require("../domain/account");
class CommandHandler {
    async createAccount(accountId, ownerName, initialBalance, currency) {
        const existingSnapshot = await eventStore_1.eventStore.getSnapshot(accountId);
        const existingEvents = await eventStore_1.eventStore.getEvents(accountId);
        if (existingSnapshot || existingEvents.length > 0) {
            throw new Error('AccountAlreadyExists');
        }
        const event = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'AccountCreated',
            eventData: { accountId, ownerName, initialBalance, currency },
            eventNumber: 1
        };
        await eventStore_1.eventStore.appendEvent(event);
    }
    async depositMoney(accountId, amount, description, transactionId) {
        const account = await this.loadAccount(accountId);
        if (account.getState().status === 'CLOSED') {
            throw new Error('AccountClosed');
        }
        const event = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'MoneyDeposited',
            eventData: { amount, description, transactionId },
            eventNumber: account.getState().eventNumber + 1
        };
        const newEvent = await eventStore_1.eventStore.appendEvent(event);
        await this.checkSnapshotTrigger(accountId, newEvent.eventNumber);
    }
    async withdrawMoney(accountId, amount, description, transactionId) {
        const account = await this.loadAccount(accountId);
        if (account.getState().status === 'CLOSED') {
            throw new Error('AccountClosed');
        }
        if (account.getState().balance < amount) {
            throw new Error('InsufficientFunds');
        }
        const event = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'MoneyWithdrawn',
            eventData: { amount, description, transactionId },
            eventNumber: account.getState().eventNumber + 1
        };
        const newEvent = await eventStore_1.eventStore.appendEvent(event);
        await this.checkSnapshotTrigger(accountId, newEvent.eventNumber);
    }
    async closeAccount(accountId, reason) {
        const account = await this.loadAccount(accountId);
        if (account.getState().balance !== 0) {
            throw new Error('BalanceNotZero');
        }
        const event = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'AccountClosed',
            eventData: { reason },
            eventNumber: account.getState().eventNumber + 1
        };
        const newEvent = await eventStore_1.eventStore.appendEvent(event);
        await this.checkSnapshotTrigger(accountId, newEvent.eventNumber);
    }
    async loadAccount(accountId) {
        const snapshot = await eventStore_1.eventStore.getSnapshot(accountId);
        const events = await eventStore_1.eventStore.getEvents(accountId, snapshot?.lastEventNumber || 0);
        if (!snapshot && events.length === 0) {
            throw new Error('AccountNotFound');
        }
        return account_1.BankAccount.replay(events, snapshot?.state);
    }
    async checkSnapshotTrigger(accountId, eventNumber) {
        if (eventNumber % 50 === 0) {
            const account = await this.loadAccount(accountId);
            await eventStore_1.eventStore.saveSnapshot(accountId, account.getState());
        }
    }
}
exports.CommandHandler = CommandHandler;
exports.commandHandler = new CommandHandler();
