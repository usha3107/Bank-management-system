export type EventType = 'AccountCreated' | 'MoneyDeposited' | 'MoneyWithdrawn' | 'AccountClosed';

export interface BaseEvent {
    eventId: string;
    aggregateId: string;
    aggregateType: 'BankAccount';
    eventType: EventType;
    eventData: any;
    eventNumber: number;
    timestamp: Date;
    version: number;
}

export interface AccountCreatedEvent extends BaseEvent {
    eventType: 'AccountCreated';
    eventData: {
        accountId: string;
        ownerName: string;
        initialBalance: number;
        currency: string;
    };
}

export interface MoneyDepositedEvent extends BaseEvent {
    eventType: 'MoneyDeposited';
    eventData: {
        amount: number;
        description: string;
        transactionId: string;
    };
}

export interface MoneyWithdrawnEvent extends BaseEvent {
    eventType: 'MoneyWithdrawn';
    eventData: {
        amount: number;
        description: string;
        transactionId: string;
    };
}

export interface AccountClosedEvent extends BaseEvent {
    eventType: 'AccountClosed';
    eventData: {
        reason: string;
    };
}

export type BankAccountEvent = AccountCreatedEvent | MoneyDepositedEvent | MoneyWithdrawnEvent | AccountClosedEvent;
