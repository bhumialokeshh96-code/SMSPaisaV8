# SMSPaisa Backend API

SMSPaisa is a passive income platform where users install an Android app that uses their phone's SIM to send SMS in the background. Users earn ₹0.16 per successful SMS delivered and can withdraw earnings via UPI or Bank transfer.

## Architecture

```
Business Clients (pay ₹0.30-0.50/SMS)
        ↓
   Your Server (Central Hub)
        ↓ (distributes SMS tasks via WebSocket)
   User Phones (Android apps — send SMS via SIM, earn ₹0.16/SMS)
        ↓ (report delivery status back)
   Server credits wallet
        ↓
   User withdraws via UPI/Bank
```

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL (via Prisma ORM)
- **Queue/Cache:** Redis
- **Real-time:** Socket.IO
- **Auth:** Firebase Auth (Phone OTP) + JWT
- **Payments:** Razorpay Payouts API

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start the server
npm start

# Development mode
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | JWT expiry (default: 30d) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret |
| `RAZORPAY_ACCOUNT_NUMBER` | Razorpay payout account number |
| `SMS_RATE_PER_DELIVERY` | Earnings per delivered SMS (default: 0.16) |
| `MIN_WITHDRAWAL_AMOUNT` | Minimum withdrawal in ₹ (default: 50) |
| `MAX_WITHDRAWAL_PER_DAY` | Max daily withdrawal in ₹ (default: 10000) |

## API Endpoints

### Health
- `GET /api/health` — Server health check

### Auth
- `POST /api/auth/send-otp` — Send OTP
- `POST /api/auth/verify-otp` — Verify OTP & get JWT
- `GET /api/auth/me` — Get current user
- `PUT /api/auth/profile` — Update profile

### SMS Tasks
- `GET /api/sms/next-task?deviceId=xxx` — Get next task
- `POST /api/sms/report-status` — Report delivery status
- `GET /api/sms/today-stats` — Today's stats
- `GET /api/sms/log` — SMS history

### Wallet
- `GET /api/wallet/balance` — Get balance
- `GET /api/wallet/transactions` — Transaction history

### Withdrawals
- `POST /api/withdraw/request` — Request withdrawal
- `GET /api/withdraw/history` — Withdrawal history
- `POST /api/withdraw/add-upi` — Add UPI ID
- `POST /api/withdraw/add-bank` — Add bank details

### Device
- `POST /api/device/register` — Register device
- `PUT /api/device/settings` — Update settings
- `POST /api/device/heartbeat` — Heartbeat
- `GET /api/device/list` — List devices

### Referral
- `GET /api/referral/code` — Get referral code
- `POST /api/referral/apply` — Apply referral code
- `GET /api/referral/stats` — Referral stats

### Admin (Admin role required)
- `GET /api/admin/users` — List users
- `GET /api/admin/users/:id` — Get user
- `GET /api/admin/stats` — Platform stats
- `GET /api/admin/devices` — Online devices
- `POST /api/admin/sms/create-task` — Create SMS task
- `POST /api/admin/sms/bulk-create` — Bulk create tasks
- `GET /api/admin/withdrawals` — List withdrawals
- `PUT /api/admin/withdrawals/:id/approve` — Approve withdrawal

## WebSocket Events

### Server → Device
- `new-task` — Push SMS task
- `task-cancelled` — Cancel task
- `balance-updated` — Balance update

### Device → Server
- `task-result` — Report result
- `device-status` — Status update
- `heartbeat` — Keep-alive

## Business Logic

### Earnings
- ₹0.16 per delivered SMS
- Only DELIVERED status earns

### Withdrawals
- Minimum: ₹50
- Maximum per day: ₹10,000
- UPI: Instant, Bank: 1-2 days

### Referrals
- Referrer earns ₹10 after 100 successful SMS by referred user
- Referred user gets ₹5 signup bonus

## Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "...", "code": "..." } }
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
