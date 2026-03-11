import { BankAccountEvent } from './events';

export type AccountStatus = 'OPEN' | 'CLOSED';

export interface BankAccountState {
    accountId: string;
    ownerName: string;
    balance: number;
    currency: string;
    status: AccountStatus;
    eventNumber: number;
}

export class BankAccount {
    private state: BankAccountState = {
        accountId: '',
        ownerName: '',
        balance: 0,
        currency: 'USD',
        status: 'OPEN',
        eventNumber: 0
    };

    constructor(state?: BankAccountState) {
        if (state) {
            this.state = { ...state };
        }
    }

    getState(): BankAccountState {
        return { ...this.state };
    }

    apply(event: BankAccountEvent): void {
        switch (event.eventType) {
            case 'AccountCreated':
                this.state.accountId = event.eventData.accountId;
                this.state.ownerName = event.eventData.ownerName;
                this.state.balance = Number(event.eventData.initialBalance);
                this.state.currency = event.eventData.currency;
                this.state.status = 'OPEN';
                break;
            case 'MoneyDeposited':
                this.state.balance += Number(event.eventData.amount);
                break;
            case 'MoneyWithdrawn':
                this.state.balance -= Number(event.eventData.amount);
                break;
            case 'AccountClosed':
                this.state.status = 'CLOSED';
                break;
        }
        this.state.eventNumber = event.eventNumber;
    }

    static replay(events: BankAccountEvent[], initialState?: BankAccountState): BankAccount {
        const account = new BankAccount(initialState);
        events.sort((a, b) => a.eventNumber - b.eventNumber).forEach(event => account.apply(event));
        return account;
    }
}
