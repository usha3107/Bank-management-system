import { eventStore } from '../infrastructure/eventStore';
import { BankAccount, BankAccountState } from '../domain/account';
import { BankAccountEvent } from '../domain/events';

export class CommandHandler {
    async createAccount(accountId: string, ownerName: string, initialBalance: number, currency: string): Promise<void> {
        const existingSnapshot = await eventStore.getSnapshot(accountId);
        const existingEvents = await eventStore.getEvents(accountId);
        
        if (existingSnapshot || existingEvents.length > 0) {
            throw new Error('AccountAlreadyExists');
        }

        const event: Omit<BankAccountEvent, 'eventId' | 'timestamp' | 'version'> = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'AccountCreated',
            eventData: { accountId, ownerName, initialBalance, currency },
            eventNumber: 1
        };

        await eventStore.appendEvent(event);
    }

    async depositMoney(accountId: string, amount: number, description: string, transactionId: string): Promise<void> {
        const account = await this.loadAccount(accountId);
        if (account.getState().status === 'CLOSED') {
            throw new Error('AccountClosed');
        }

        const event: Omit<BankAccountEvent, 'eventId' | 'timestamp' | 'version'> = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'MoneyDeposited',
            eventData: { amount, description, transactionId },
            eventNumber: account.getState().eventNumber + 1
        };

        const newEvent = await eventStore.appendEvent(event);
        await this.checkSnapshotTrigger(accountId, newEvent.eventNumber);
    }

    async withdrawMoney(accountId: string, amount: number, description: string, transactionId: string): Promise<void> {
        const account = await this.loadAccount(accountId);
        if (account.getState().status === 'CLOSED') {
            throw new Error('AccountClosed');
        }
        if (account.getState().balance < amount) {
            throw new Error('InsufficientFunds');
        }

        const event: Omit<BankAccountEvent, 'eventId' | 'timestamp' | 'version'> = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'MoneyWithdrawn',
            eventData: { amount, description, transactionId },
            eventNumber: account.getState().eventNumber + 1
        };

        const newEvent = await eventStore.appendEvent(event);
        await this.checkSnapshotTrigger(accountId, newEvent.eventNumber);
    }

    async closeAccount(accountId: string, reason: string): Promise<void> {
        const account = await this.loadAccount(accountId);
        if (account.getState().balance !== 0) {
            throw new Error('BalanceNotZero');
        }

        const event: Omit<BankAccountEvent, 'eventId' | 'timestamp' | 'version'> = {
            aggregateId: accountId,
            aggregateType: 'BankAccount',
            eventType: 'AccountClosed',
            eventData: { reason },
            eventNumber: account.getState().eventNumber + 1
        };

        const newEvent = await eventStore.appendEvent(event);
        await this.checkSnapshotTrigger(accountId, newEvent.eventNumber);
    }

    async loadAccount(accountId: string): Promise<BankAccount> {
        const snapshot = await eventStore.getSnapshot(accountId);
        const events = await eventStore.getEvents(accountId, snapshot?.lastEventNumber || 0);
        
        if (!snapshot && events.length === 0) {
            throw new Error('AccountNotFound');
        }

        return BankAccount.replay(events, snapshot?.state);
    }

    private async checkSnapshotTrigger(accountId: string, eventNumber: number): Promise<void> {
        if (eventNumber % 50 === 0) {
            const account = await this.loadAccount(accountId);
            await eventStore.saveSnapshot(accountId, account.getState());
        }
    }
}

export const commandHandler = new CommandHandler();
