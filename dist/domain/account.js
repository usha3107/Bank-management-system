"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankAccount = void 0;
class BankAccount {
    constructor(state) {
        this.state = {
            accountId: '',
            ownerName: '',
            balance: 0,
            currency: 'USD',
            status: 'OPEN',
            eventNumber: 0
        };
        if (state) {
            this.state = { ...state };
        }
    }
    getState() {
        return { ...this.state };
    }
    apply(event) {
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
    static replay(events, initialState) {
        const account = new BankAccount(initialState);
        events.sort((a, b) => a.eventNumber - b.eventNumber).forEach(event => account.apply(event));
        return account;
    }
}
exports.BankAccount = BankAccount;
