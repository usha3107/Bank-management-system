# Bank Account Management System (ES/CQRS)

A robust, production-grade Bank Account Management API designed using **Event Sourcing (ES)** and **Command Query Responsibility Segregation (CQRS)**. This architecture ensures complete auditability, high reliability, and historical accuracy, making it ideal for financial domains.

## 🌟 Key Features

- **Event Sourcing**: Every state change is stored as an immutable event in a sequential log.
- **CQRS Architecture**: Complete separation of write (Command) and read (Query) models.
- **Automatic Snapshotting**: State is snapshotted every 50 events to optimize reconstruction time.
- **Time Travel Queries**: Reconstruct and view account balances at any precise moment in history using ISO 8601 timestamps.
- **Projection Rebuilds**: Dynamically rebuild read-model projections from the definitive event store.
- **Fully Containerized**: Ready for deployment with Docker and Docker Compose.

## 🛠️ Technology Stack

- **Runtime**: Node.js 18
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Infrastructure**: Docker, Docker Compose

---

## 🚀 Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Installation & Deployment
1.  **Clone/Set up the directory**:
    ```bash
    cd Bank-management-system
    ```

2.  **Environment Setup**:
    Create a `.env` file from the example:
    ```bash
    cp .env.example .env
    ```

3.  **Start the System**:
    ```bash
    docker-compose up -d --build
    ```
    *The API will be available at `http://localhost:8080` once the containers are healthy.*

---

## 📡 API Reference

### Command Endpoints (Write Side)
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/accounts` | `POST` | Create a new bank account. |
| `/api/accounts/:id/deposit` | `POST` | Deposit funds (requires unique `transactionId`). |
| `/api/accounts/:id/withdraw` | `POST` | Withdraw funds (validates against current balance). |
| `/api/accounts/:id/close` | `POST` | Close account (only if balance is zero). |

### Query Endpoints (Read Side)
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/accounts/:id` | `GET` | Get current summary (balance, status, owner). |
| `/api/accounts/:id/transactions` | `GET` | Get paginated transaction history (`page`, `pageSize`). |
| `/api/accounts/:id/events` | `GET` | View the full immutable audit trail of events. |
| `/api/accounts/:id/balance-at/:ts`| `GET` | View balance at a specific point in history. |

### Maintenance Endpoints
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/projections/rebuild` | `POST` | Wipes and rebuilds projections from the Event Store. |
| `/api/projections/status` | `GET` | Monitor event counts and projection lag. |

---

## 🏗️ Architectural Overview

### 1. The Write Model (Commands)
When a command is received, the system:
- Reconstructs the current **Aggregate State** by replaying events (leveraging snapshots for speed).
- Validates the request against business rules (e.g., non-negative balance).
- Persists a new **Domain Event** to the `events` table in PostgreSQL.

### 2. The Read Model (Projections)
The system automatically updates denormalized tables (`account_summaries`, `transaction_history`) whenever an event is persisted. These tables are optimized for high-performance GET requests.

### 3. Snapshotting Strategy
To prevent replaying thousands of events for an old account, the system saves a "Snapshot" of the state at every 50th event. Reconstruction then only requires loading the latest snapshot + events created after it.

---

## 🧪 Verification
To verify the system status, you can check the health endpoint:
```bash
curl http://localhost:8080/health
```
