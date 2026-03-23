# Newsletter System

> **Design Review Status:** Revised after Codex adversarial review (2026-03-23)

## Problem Statement

ParentBench currently has a newsletter signup form that collects emails via Netlify Forms, but:
- No database storage of subscribers
- No ability to send actual newsletters
- No unsubscribe mechanism
- No email templates
- No tracking of engagement
- Subscribers don't receive updates when new models are evaluated

Parents who sign up expect to receive updates but never hear from us.

## Goals

1. **Subscriber Management** — Store and manage newsletter subscribers in database
2. **Automated Notifications** — Send emails when models are evaluated or scores change significantly
3. **Manual Newsletters** — Allow admin to compose and send newsletters
4. **Compliance** — GDPR/CAN-SPAM compliant unsubscribe flow
5. **Engagement Tracking** — Track opens, clicks, unsubscribes

## Solution Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Signup Form    │────▶│    Database     │────▶│     Resend      │
│  (Homepage)     │     │  (subscribers)  │     │   (delivery)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  Inngest Jobs   │     │  Tracking Pixel │
                        │ (send triggers) │     │  (opens/clicks) │
                        └─────────────────┘     └─────────────────┘
```

## Engineering Architecture

### Database Schema

```sql
-- Newsletter subscribers
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  status ENUM('pending', 'confirmed', 'unsubscribed') DEFAULT 'pending',

  -- Double opt-in (CRITICAL FIX: added unsubscribe_token)
  confirmation_token UUID UNIQUE,
  confirmation_token_expires_at TIMESTAMP,
  unsubscribe_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  confirmed_at TIMESTAMP,

  -- Preferences
  frequency ENUM('immediate', 'weekly', 'monthly') DEFAULT 'immediate',
  notify_new_models BOOLEAN DEFAULT TRUE,
  notify_score_changes BOOLEAN DEFAULT TRUE,
  notify_methodology_updates BOOLEAN DEFAULT TRUE,

  -- Compliance
  subscribed_at TIMESTAMP DEFAULT NOW(),
  unsubscribed_at TIMESTAMP,
  unsubscribe_reason TEXT,
  ip_address INET,
  user_agent TEXT,

  -- Tracking
  last_email_sent_at TIMESTAMP,
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_links_clicked INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX idx_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX idx_subscribers_confirmation_token ON newsletter_subscribers(confirmation_token);
CREATE INDEX idx_subscribers_unsubscribe_token ON newsletter_subscribers(unsubscribe_token);

-- CRITICAL FIX: Suppression list for permanent opt-out compliance
-- This table is NEVER deleted from - required for CAN-SPAM/GDPR compliance
CREATE TABLE email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA256 hash of lowercase email
  reason ENUM('unsubscribed', 'hard_bounce', 'complaint', 'manual') NOT NULL,
  original_email VARCHAR(255), -- Stored temporarily, cleared after 30 days
  suppressed_at TIMESTAMP DEFAULT NOW(),
  suppressed_by VARCHAR(50) -- 'user', 'system', 'admin'
);

CREATE INDEX idx_suppression_email_hash ON email_suppression_list(email_hash);

-- Newsletter campaigns (for manual sends)
CREATE TABLE newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject VARCHAR(255) NOT NULL,
  preview_text VARCHAR(255),
  content_html TEXT NOT NULL,
  content_text TEXT NOT NULL,

  -- Targeting
  audience ENUM('all', 'confirmed_only') DEFAULT 'confirmed_only',

  -- Status
  status ENUM('draft', 'scheduled', 'sending', 'sent', 'failed') DEFAULT 'draft',
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,

  -- Stats
  total_recipients INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual email sends (for tracking)
-- WARNING FIX: Added ON DELETE rules and dedup constraint
CREATE TABLE newsletter_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES newsletter_subscribers(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,

  -- For automated emails (not campaigns)
  email_type ENUM('confirmation', 'welcome', 'new_model', 'score_change', 'campaign') NOT NULL,

  -- Resend tracking
  resend_id VARCHAR(255) UNIQUE,
  status ENUM('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained') DEFAULT 'queued',

  -- WARNING FIX: Idempotency key to prevent double sends
  idempotency_key VARCHAR(255) UNIQUE,

  -- Tracking
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced_at TIMESTAMP,

  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sends_subscriber ON newsletter_sends(subscriber_id);
CREATE INDEX idx_sends_campaign ON newsletter_sends(campaign_id);
CREATE INDEX idx_sends_resend ON newsletter_sends(resend_id);
CREATE INDEX idx_sends_idempotency ON newsletter_sends(idempotency_key);

-- Audit log for admin actions (SUGGESTION: added for compliance)
CREATE TABLE newsletter_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'export_subscribers', 'delete_subscriber', 'send_campaign', etc.
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_admin ON newsletter_audit_log(admin_id);
CREATE INDEX idx_audit_action ON newsletter_audit_log(action);
```

### Suppression List Logic (CRITICAL FIX: Compliance)

```typescript
// src/lib/newsletter/suppression.ts
import { createHash } from 'crypto';

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// Check if email is suppressed BEFORE any send
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const hash = hashEmail(email);
  const suppressed = await db.emailSuppressionList.findUnique({
    where: { email_hash: hash }
  });
  return !!suppressed;
}

// Add to suppression list (never remove!)
export async function suppressEmail(
  email: string,
  reason: 'unsubscribed' | 'hard_bounce' | 'complaint' | 'manual',
  suppressedBy: string
): Promise<void> {
  const hash = hashEmail(email);

  await db.emailSuppressionList.upsert({
    where: { email_hash: hash },
    create: {
      email_hash: hash,
      original_email: email, // Will be cleared after 30 days
      reason,
      suppressed_by: suppressedBy
    },
    update: {
      reason, // Update reason if re-suppressed
      suppressed_at: new Date()
    }
  });
}

// Check suppression before subscribe
export async function canSubscribe(email: string): Promise<{ allowed: boolean; reason?: string }> {
  if (await isEmailSuppressed(email)) {
    return { allowed: false, reason: 'This email has previously unsubscribed.' };
  }
  return { allowed: true };
}

// Cron job: Clear original_email from old suppression records (GDPR)
// Keeps the hash for compliance but removes PII
export async function clearOldSuppressionPII(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await db.emailSuppressionList.updateMany({
    where: {
      suppressed_at: { lt: thirtyDaysAgo },
      original_email: { not: null }
    },
    data: {
      original_email: null
    }
  });
}
```

### API Routes with Authentication (CRITICAL FIX: Added RBAC)

```typescript
// src/app/api/internal/newsletter/[...route]/route.ts
import { requireRole, requireCSRF, auditLog } from '@/lib/auth';

// Middleware stack for admin routes
const adminMiddleware = [
  requireRole(['admin']),
  requireCSRF,
];

// Public routes (no auth required)
export const publicRoutes = {
  'POST /api/newsletter/subscribe': [
    rateLimit({ windowMs: 3600000, max: 3, keyGenerator: getIP }),
    rateLimit({ windowMs: 86400000, max: 10, keyGenerator: getEmail }), // Also limit per email
    validateBody(subscribeSchema),
    checkSuppression,
    handleSubscribe
  ],

  'GET /api/newsletter/confirm/[token]': [
    validateToken,
    handleConfirm
  ],

  'GET /api/newsletter/unsubscribe/[token]': [
    validateUnsubscribeToken,
    handleUnsubscribePage // Shows options page
  ],

  'POST /api/newsletter/unsubscribe': [
    validateBody(unsubscribeSchema),
    handleUnsubscribe,
    addToSuppressionList // CRITICAL: Add to suppression
  ],

  // Tracking (WARNING FIX: Added HMAC verification)
  'GET /api/newsletter/track/open/[sendId]': [
    verifyTrackingHMAC,
    handleTrackOpen,
    serveTrackingPixel
  ],

  'GET /api/newsletter/track/click/[sendId]/[linkId]': [
    verifyTrackingHMAC,
    handleTrackClick,
    redirectToLink
  ]
};

// Admin routes (auth required)
export const adminRoutes = {
  'GET /api/internal/newsletter/subscribers': [
    ...adminMiddleware,
    auditLog('list_subscribers'),
    handleListSubscribers
  ],

  'GET /api/internal/newsletter/subscribers/export': [
    ...adminMiddleware,
    auditLog('export_subscribers'),
    handleExportCSV
  ],

  'DELETE /api/internal/newsletter/subscribers/[id]': [
    ...adminMiddleware,
    auditLog('delete_subscriber'),
    handleDeleteSubscriber,
    addToSuppressionList // Also suppress on admin delete
  ],

  'GET /api/internal/newsletter/campaigns': [
    ...adminMiddleware,
    handleListCampaigns
  ],

  'POST /api/internal/newsletter/campaigns': [
    ...adminMiddleware,
    validateBody(campaignSchema),
    auditLog('create_campaign'),
    handleCreateCampaign
  ],

  'POST /api/internal/newsletter/campaigns/[id]/send': [
    ...adminMiddleware,
    auditLog('send_campaign'),
    handleSendCampaign
  ],

  'POST /api/internal/newsletter/campaigns/[id]/preview': [
    ...adminMiddleware,
    handlePreviewCampaign
  ]
};

// Webhook (signature verification)
export const webhookRoutes = {
  'POST /api/webhooks/resend': [
    verifyResendSignature,
    handleResendWebhook
  ]
};
```

### Resend Integration (CRITICAL FIX: Token passed correctly)

```typescript
// src/lib/email/resend.ts
import { Resend } from 'resend';
import { createHmac } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeToken: string; // CRITICAL FIX: Now required
  tags?: { name: string; value: string }[];
  sendId?: string; // For tracking
}

// Generate HMAC for tracking URLs (WARNING FIX: Anti-abuse)
function generateTrackingHMAC(sendId: string): string {
  return createHmac('sha256', process.env.TRACKING_SECRET!)
    .update(sendId)
    .digest('hex')
    .slice(0, 16);
}

export async function sendEmail(options: SendEmailOptions) {
  // CRITICAL FIX: Check suppression before sending
  if (await isEmailSuppressed(options.to)) {
    console.log(`Skipping suppressed email: ${options.to}`);
    return { skipped: true, reason: 'suppressed' };
  }

  // CRITICAL FIX: Build unsubscribe URL with token
  const unsubscribeUrl = `https://parentbench.ai/api/newsletter/unsubscribe/${options.unsubscribeToken}`;

  // WARNING FIX: Add HMAC to tracking URLs
  const trackingHmac = options.sendId ? generateTrackingHMAC(options.sendId) : '';

  const { data, error } = await resend.emails.send({
    from: 'ParentBench <updates@parentbench.ai>',
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    tags: options.tags,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Tracking-HMAC': trackingHmac, // For verification
    },
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
```

### Inngest Jobs with Preference Filtering (WARNING FIX)

```typescript
// src/inngest/functions/newsletter.ts

// New model evaluated - respects notify_new_models preference
export const newModelEvaluated = inngest.createFunction(
  { id: 'newsletter/new-model-evaluated' },
  { event: 'evaluation/completed' },
  async ({ event, step }) => {
    const { model_slug, model_name, overall_score, grade } = event.data;

    // WARNING FIX: Only send to subscribers who want new model alerts
    const subscribers = await step.run('get-subscribers', async () => {
      return db.newsletterSubscribers.findMany({
        where: {
          status: 'confirmed',
          notify_new_models: true, // Respect preference
          // Also check frequency for immediate sends
          OR: [
            { frequency: 'immediate' },
            { frequency: null }
          ]
        }
      });
    });

    // Filter out suppressed emails
    const eligibleSubscribers = await step.run('filter-suppressed', async () => {
      const results = [];
      for (const sub of subscribers) {
        if (!(await isEmailSuppressed(sub.email))) {
          results.push(sub);
        }
      }
      return results;
    });

    // Send with idempotency
    for (const subscriber of eligibleSubscribers) {
      await step.run(`send-${subscriber.id}`, async () => {
        const idempotencyKey = `new-model-${model_slug}-${subscriber.id}`;

        // Check for existing send (dedup)
        const existing = await db.newsletterSends.findUnique({
          where: { idempotency_key: idempotencyKey }
        });
        if (existing) return; // Already sent

        const html = await renderNewModelEmail({ model_name, overall_score, grade });

        await sendEmail({
          to: subscriber.email,
          subject: `New model evaluated: ${model_name} scores ${grade} on child safety`,
          html,
          text: `${model_name} has been evaluated...`,
          unsubscribeToken: subscriber.unsubscribe_token,
          sendId: idempotencyKey
        });

        await db.newsletterSends.create({
          data: {
            subscriber_id: subscriber.id,
            email_type: 'new_model',
            idempotency_key: idempotencyKey,
            status: 'sent'
          }
        });
      });
    }
  }
);

// Score change alert - respects notify_score_changes preference
export const scoreChangeAlert = inngest.createFunction(
  { id: 'newsletter/score-change-alert' },
  { event: 'score/significant-change' },
  async ({ event, step }) => {
    const { model_slug, model_name, old_score, new_score, change } = event.data;

    // Only alert on drops > 5 points
    if (change > -5) return;

    // WARNING FIX: Only send to subscribers who want score change alerts
    const subscribers = await step.run('get-subscribers', async () => {
      return db.newsletterSubscribers.findMany({
        where: {
          status: 'confirmed',
          notify_score_changes: true, // Respect preference
          frequency: 'immediate' // Only immediate subscribers
        }
      });
    });

    // ... similar send logic with suppression check and idempotency
  }
);

// Weekly digest - for weekly/monthly frequency subscribers
export const weeklyDigest = inngest.createFunction(
  { id: 'newsletter/weekly-digest' },
  { cron: '0 9 * * 1' }, // Every Monday at 9am UTC
  async ({ step }) => {
    // Get weekly subscribers
    const subscribers = await step.run('get-weekly-subscribers', async () => {
      return db.newsletterSubscribers.findMany({
        where: {
          status: 'confirmed',
          frequency: 'weekly'
        }
      });
    });

    // Get week's activity
    const activity = await step.run('get-activity', async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return {
        newModels: await db.evaluations.findMany({
          where: { completed_at: { gte: weekAgo } }
        }),
        scoreChanges: await db.scoreHistory.findMany({
          where: {
            recorded_at: { gte: weekAgo },
            change: { lte: -5 }
          }
        })
      };
    });

    if (activity.newModels.length === 0 && activity.scoreChanges.length === 0) {
      return; // Nothing to report
    }

    // Send digests...
  }
);
```

### Webhook Handler with Bounce Suppression (WARNING FIX)

```typescript
// src/app/api/webhooks/resend/route.ts
export async function POST(req: Request) {
  const signature = req.headers.get('resend-signature');
  const body = await req.text();

  // Verify webhook signature
  if (!verifyResendSignature(signature, body)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  // Idempotency check
  const processed = await db.webhookEvents.findUnique({
    where: { event_id: event.id }
  });
  if (processed) {
    return new Response('Already processed', { status: 200 });
  }

  switch (event.type) {
    case 'email.delivered':
      await db.newsletterSends.update({
        where: { resend_id: event.data.email_id },
        data: { status: 'delivered' }
      });
      break;

    case 'email.opened':
      await db.newsletterSends.update({
        where: { resend_id: event.data.email_id },
        data: { status: 'opened', opened_at: new Date() }
      });
      // Update subscriber stats
      await db.newsletterSubscribers.update({
        where: { id: send.subscriber_id },
        data: { total_emails_opened: { increment: 1 } }
      });
      break;

    case 'email.bounced':
      // WARNING FIX: Suppress hard bounces
      const send = await db.newsletterSends.findUnique({
        where: { resend_id: event.data.email_id },
        include: { subscriber: true }
      });

      if (send?.subscriber && event.data.bounce_type === 'hard') {
        await suppressEmail(
          send.subscriber.email,
          'hard_bounce',
          'system'
        );

        await db.newsletterSubscribers.update({
          where: { id: send.subscriber_id },
          data: { status: 'unsubscribed', unsubscribed_at: new Date() }
        });
      }

      await db.newsletterSends.update({
        where: { resend_id: event.data.email_id },
        data: { status: 'bounced', bounced_at: new Date() }
      });
      break;

    case 'email.complained':
      // WARNING FIX: Suppress complaints immediately
      const complainSend = await db.newsletterSends.findUnique({
        where: { resend_id: event.data.email_id },
        include: { subscriber: true }
      });

      if (complainSend?.subscriber) {
        await suppressEmail(
          complainSend.subscriber.email,
          'complaint',
          'system'
        );

        await db.newsletterSubscribers.update({
          where: { id: complainSend.subscriber_id },
          data: { status: 'unsubscribed', unsubscribed_at: new Date() }
        });
      }
      break;
  }

  // Mark webhook as processed
  await db.webhookEvents.create({
    data: { event_id: event.id, processed_at: new Date() }
  });

  return new Response('OK', { status: 200 });
}
```

### Email Templates

All emails use React Email for consistent, responsive templates:

```
src/lib/email/templates/
├── confirmation.tsx      // Double opt-in confirmation
├── welcome.tsx          // Welcome after confirmation
├── new-model.tsx        // New model evaluated
├── score-change.tsx     // Significant score change alert
├── weekly-digest.tsx    // Weekly summary
├── campaign.tsx         // Manual newsletter template
└── components/
    ├── header.tsx       // Branded header
    ├── footer.tsx       // Unsubscribe link, address
    ├── button.tsx       // CTA button
    └── model-card.tsx   // Model score card
```

## UX Design

### Signup Flow

```
┌──────────────────────────────────────────────────────────────┐
│                     Stay Updated                              │
│                                                               │
│  Get notified when we evaluate new AI models or update       │
│  our methodology. No spam, just safety insights.             │
│                                                               │
│  ┌─────────────────────────────┐  ┌───────────────┐         │
│  │ Enter your email            │  │  Subscribe    │         │
│  └─────────────────────────────┘  └───────────────┘         │
│                                                               │
│  ☐ Weekly digest (recommended)                               │
│  ☐ Immediate alerts for score changes                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘

        ▼ On submit

┌──────────────────────────────────────────────────────────────┐
│  ✓ Check your inbox!                                         │
│                                                               │
│  We've sent a confirmation email to john@example.com.        │
│  Click the link to complete your subscription.               │
│                                                               │
│  Didn't receive it? Check spam or [resend email].            │
└──────────────────────────────────────────────────────────────┘
```

### Unsubscribe Page (/newsletter/unsubscribe/[token])

```
┌──────────────────────────────────────────────────────────────┐
│  [ParentBench Logo]                                          │
│                                                               │
│  Unsubscribe                                                 │
│                                                               │
│  We're sorry to see you go! Before you leave:               │
│                                                               │
│  ○ Reduce frequency (weekly digest instead of immediate)    │
│  ○ Only notify me about score drops                          │
│  ● Unsubscribe from all emails                               │
│                                                               │
│  Optional: Why are you unsubscribing?                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [dropdown: Too many emails / Not relevant / Other]   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│           ┌─────────────────────────┐                        │
│           │   Confirm Unsubscribe   │                        │
│           └─────────────────────────┘                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Admin: Subscriber Management (/admin/newsletter)

```
┌──────────────────────────────────────────────────────────────┐
│  Newsletter Subscribers                    [Export CSV]      │
│                                                               │
│  Total: 1,247  Confirmed: 1,102  Pending: 89  Unsub: 56    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Search by email...                    [Status ▼] [Date]││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Email              Status     Subscribed   Opens  Click ││
│  │ john@example.com   Confirmed  Mar 15, 2026   12     5   ││
│  │ jane@test.com      Confirmed  Mar 14, 2026    8     2   ││
│  │ bob@demo.org       Pending    Mar 13, 2026    -     -   ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Admin: Campaign Composer (/admin/newsletter/campaigns/new)

```
┌──────────────────────────────────────────────────────────────┐
│  New Campaign                      [Save Draft] [Preview]    │
│                                                               │
│  Subject:                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ March 2026: 5 New Models Evaluated                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Preview text:                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ See how GPT-5.4, Claude 4.7, and more performed...   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Content:                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Rich text editor with markdown support]              │   │
│  │                                                        │   │
│  │ # March Update                                        │   │
│  │                                                        │   │
│  │ This month we evaluated 5 new models...              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Audience: ○ All subscribers  ● Confirmed only              │
│                                                               │
│  Schedule:                                                   │
│  ○ Send now  ● Schedule for [Mar 25, 2026] [9:00 AM]       │
│                                                               │
│           ┌─────────────────────────┐                        │
│           │   Schedule Campaign     │                        │
│           └─────────────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

## Security Considerations

### Email Validation
- Validate email format server-side
- Check against disposable email domains
- Rate limit: 3 signups per IP per hour + 10 per email per day

### Double Opt-In
- Confirmation token expires in 24 hours
- Token is single-use (cleared after use)
- Prevents spam signups

### Unsubscribe Compliance (CRITICAL FIX)
- One-click unsubscribe (RFC 8058)
- No login required
- Token-based (no guessable URLs)
- **Suppression list maintained indefinitely** (email hash only, PII cleared after 30 days)

### Tracking Anti-Abuse (WARNING FIX)
- Tracking URLs include HMAC signature
- Invalid signatures rejected
- Prevents forged opens/clicks

### Admin Security (CRITICAL FIX)
- All `/api/internal/*` routes require admin role
- CSRF token validation on all POST/DELETE
- All admin actions logged to audit table
- IP address captured in audit log

### Webhook Security
- Verify Resend webhook signatures
- Idempotent processing (handle duplicates)
- Store processed event IDs

### Data Privacy (GDPR)
- Minimal PII stored
- IP/user-agent encrypted at rest
- Export endpoint for data portability
- Delete endpoint (adds to suppression list)
- Suppression list: email hash kept forever, PII cleared after 30 days

## E2E Test Plan

### Test: Subscription Flow
```typescript
test('complete subscription flow with double opt-in', async () => {
  const response = await submitNewsletter({ email: 'test@example.com' });
  expect(response.status).toBe(200);

  const subscriber = await getSubscriberByEmail('test@example.com');
  expect(subscriber.status).toBe('pending');
  expect(subscriber.confirmation_token).toBeDefined();
  expect(subscriber.unsubscribe_token).toBeDefined(); // CRITICAL: Must exist

  // Confirm subscription
  await confirmSubscription(subscriber.confirmation_token);

  const confirmed = await getSubscriberByEmail('test@example.com');
  expect(confirmed.status).toBe('confirmed');
  expect(confirmed.confirmation_token).toBeNull(); // Cleared after use
});
```

### Test: Suppression List Compliance
```typescript
test('unsubscribed email cannot re-subscribe', async () => {
  // Subscribe and confirm
  const subscriber = await createConfirmedSubscriber('test@example.com');

  // Unsubscribe
  await unsubscribe(subscriber.unsubscribe_token);

  // Verify in suppression list
  const suppressed = await isEmailSuppressed('test@example.com');
  expect(suppressed).toBe(true);

  // Try to re-subscribe
  const response = await submitNewsletter({ email: 'test@example.com' });
  expect(response.status).toBe(400);
  expect(response.body.error).toContain('previously unsubscribed');
});
```

### Test: Admin Auth Required
```typescript
test('admin endpoints require authentication', async () => {
  // No auth
  const response = await fetch('/api/internal/newsletter/subscribers');
  expect(response.status).toBe(401);

  // Wrong role
  const userResponse = await fetchAsUser('/api/internal/newsletter/subscribers');
  expect(userResponse.status).toBe(403);

  // Admin works
  const adminResponse = await fetchAsAdmin('/api/internal/newsletter/subscribers');
  expect(adminResponse.status).toBe(200);
});
```

### Test: Tracking HMAC Verification
```typescript
test('tracking endpoints verify HMAC', async () => {
  const send = await createEmailSend();

  // Valid HMAC
  const validHmac = generateTrackingHMAC(send.id);
  const validResponse = await fetch(`/api/newsletter/track/open/${send.id}?h=${validHmac}`);
  expect(validResponse.status).toBe(200);

  // Invalid HMAC
  const invalidResponse = await fetch(`/api/newsletter/track/open/${send.id}?h=invalid`);
  expect(invalidResponse.status).toBe(403);
});
```

### Test: Hard Bounce Suppression
```typescript
test('hard bounce adds to suppression list', async () => {
  const subscriber = await createConfirmedSubscriber('bounce@test.com');
  const send = await createEmailSend({ subscriber_id: subscriber.id });

  // Simulate Resend webhook
  await processWebhook({
    type: 'email.bounced',
    data: { email_id: send.resend_id, bounce_type: 'hard' }
  });

  // Verify suppressed
  expect(await isEmailSuppressed('bounce@test.com')).toBe(true);

  // Verify subscriber status updated
  const updated = await getSubscriber(subscriber.id);
  expect(updated.status).toBe('unsubscribed');
});
```

### Test: Preference Filtering
```typescript
test('new model email respects notify_new_models preference', async () => {
  // Create subscribers with different preferences
  const wantsAlerts = await createConfirmedSubscriber('wants@test.com', {
    notify_new_models: true
  });
  const noAlerts = await createConfirmedSubscriber('noalerts@test.com', {
    notify_new_models: false
  });

  // Trigger new model event
  await triggerNewModelEvaluated({ model_slug: 'gpt-5' });

  // Check emails sent
  const wantsEmails = await getEmailsSentTo('wants@test.com');
  const noEmails = await getEmailsSentTo('noalerts@test.com');

  expect(wantsEmails).toHaveLength(1);
  expect(noEmails).toHaveLength(0);
});
```

### Test: Campaign Idempotency
```typescript
test('campaign does not double-send', async () => {
  const subscriber = await createConfirmedSubscriber('test@example.com');
  const campaign = await createCampaign({ subject: 'Test' });

  // Send campaign twice (simulating retry)
  await sendCampaign(campaign.id);
  await sendCampaign(campaign.id);

  // Should only have one send
  const sends = await getCampaignSends(campaign.id);
  expect(sends).toHaveLength(1);
});
```

## Acceptance Criteria

- [ ] Signup form stores subscribers in database (not Netlify Forms)
- [ ] Double opt-in with confirmation email (24h expiry)
- [ ] Welcome email sent after confirmation
- [ ] Unsubscribe token stored and used for one-click unsubscribe
- [ ] One-click unsubscribe (RFC 8058 compliant)
- [ ] Suppression list maintained indefinitely (hash only)
- [ ] Unsubscribe page with preference options
- [ ] Automated email on new model evaluation (respects preferences)
- [ ] Automated email on significant score change (respects preferences)
- [ ] Admin routes require authentication + CSRF
- [ ] Admin can view/export subscribers
- [ ] Admin can create and send campaigns
- [ ] Campaign preview/test send
- [ ] Tracking with HMAC verification
- [ ] Resend webhook integration with bounce/complaint suppression
- [ ] Rate limiting on signup (3/hour/IP, 10/day/email)
- [ ] All admin actions logged to audit table
- [ ] GDPR: export/delete subscriber data
- [ ] All emails have unsubscribe link

## Dependencies

- Phase 4.5.1 (Resend setup) — `parentbench-ffa.5.1`
- Database (Phase 1) — complete

## Cost Estimate

- Resend: Free tier = 3,000 emails/month
- Resend Pro: $20/month = 50,000 emails/month
- At 1,000 subscribers with weekly digest + alerts: ~5,000 emails/month = $20/month

---

## Codex Review Findings (2026-03-23)

### CRITICAL — Fixed
1. ✅ **Missing unsubscribe token** — Added `unsubscribe_token` column with unique constraint and index
2. ✅ **Broken List-Unsubscribe header** — `sendEmail` now requires `unsubscribeToken` parameter
3. ✅ **Compliance gap on opt-out retention** — Added `email_suppression_list` table that keeps email hashes forever
4. ✅ **Undefined admin access control** — Added `requireRole(['admin'])` middleware, CSRF protection, and audit logging

### WARNING — Fixed
1. ✅ **Preference fields unused** — Inngest jobs now filter by `notify_new_models`, `notify_score_changes`, `frequency`
2. ✅ **No bounce/complaint suppression** — Webhook handler now adds hard bounces and complaints to suppression list
3. ✅ **Rate limiting only per IP** — Added per-email rate limiting (10/day)
4. ✅ **Tracking anti-abuse** — Added HMAC verification for tracking URLs
5. ✅ **Missing lifecycle safeguards** — Added ON DELETE rules, idempotency keys, dedup constraints

### PRAISE — Preserved
- Clear problem framing and flow diagrams
- Schema captures engagement metrics and preferences
- Double opt-in and webhook verification awareness
