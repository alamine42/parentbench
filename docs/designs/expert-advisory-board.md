# Expert Advisory Board & Peer Review

## Problem Statement

ParentBench's credibility depends on external validation. Currently:

1. **No external oversight** — Methodology created internally without expert review
2. **No academic validation** — No peer-reviewed papers establishing rigor
3. **No practitioner input** — No child psychologists, pediatricians, or educators involved
4. **No parent representation** — The people we serve aren't shaping priorities
5. **No regulatory alignment** — No formal mapping to COPPA, EU AI Act, UK Online Safety Bill

Without external credibility, the benchmark risks being dismissed as "just another leaderboard."

## Goals

1. **Expert Panel** — Recruit diverse advisory board (child development, AI safety, legal, parent advocates)
2. **Peer Review Process** — Publish methodology for academic peer review
3. **Regulatory Mapping** — Formal alignment with emerging child safety regulations
4. **Transparency Reports** — Quarterly reports on methodology updates and governance
5. **Conflict of Interest Policy** — Clear rules preventing vendor influence

## Solution Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Expert Advisory Board System                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Advisory Board Portal                          │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│  │  │ Child Dev   │ │ AI Safety   │ │ Legal/      │ │ Parent      │  │  │
│  │  │ Experts     │ │ Researchers │ │ Regulatory  │ │ Advocates   │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Review & Governance                             │  │
│  │  • Methodology review (quarterly)                                  │  │
│  │  • Test case validation                                           │  │
│  │  • Scoring rubric approval                                        │  │
│  │  • Dispute resolution                                             │  │
│  │  • Regulatory compliance certification                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Public Transparency                             │  │
│  │  • Published methodology (peer-reviewed)                          │  │
│  │  • Board member bios & COI disclosures                            │  │
│  │  • Quarterly governance reports                                   │  │
│  │  • Meeting minutes (redacted)                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Advisory Board Composition

### Required Expertise Areas

| Category | Role | Example Background |
|----------|------|-------------------|
| Child Development | Child Psychologist | PhD in developmental psychology, research on children & technology |
| Child Development | Pediatrician | MD with focus on adolescent medicine, screen time research |
| Child Development | Educator | K-12 educator with EdTech experience |
| AI Safety | AI Safety Researcher | PhD in ML safety, publications on alignment/RLHF |
| AI Safety | AI Ethics Researcher | Work on fairness, accountability, transparency |
| Legal/Regulatory | Child Privacy Attorney | COPPA expertise, children's online privacy |
| Legal/Regulatory | Policy Expert | Work with FTC, EU Commission, or similar |
| Parent Advocacy | Parent Advocate | Leadership at Common Sense Media, Family Online Safety Institute, or similar |
| Parent Advocacy | Parent Representative | Actual parent of minor children, diverse background |

### Board Structure

- **Size:** 9-12 members
- **Term:** 2 years, staggered (half rotate each year)
- **Chair:** Elected by board, 1-year term
- **Compensation:** Honorarium for meeting participation (prevents only wealthy participation)
- **Time commitment:** ~4 hours/month (1 meeting + async review)

## Engineering Architecture

### Database Schema

```sql
-- Advisory board members
CREATE TABLE advisory_board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Personal info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  bio TEXT NOT NULL,
  photo_url VARCHAR(500),

  -- Professional
  title VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  expertise_area VARCHAR(50) NOT NULL, -- 'child_development', 'ai_safety', 'legal_regulatory', 'parent_advocacy'
  linkedin_url VARCHAR(500),

  -- Board role
  role VARCHAR(50) DEFAULT 'member', -- 'member', 'chair', 'emeritus'
  term_start DATE NOT NULL,
  term_end DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  -- Conflict of interest
  coi_disclosure TEXT NOT NULL, -- Required disclosure
  coi_last_updated TIMESTAMP NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_board_active ON advisory_board_members(is_active);
CREATE INDEX idx_board_expertise ON advisory_board_members(expertise_area);

-- COI declarations (historical record)
CREATE TABLE coi_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES advisory_board_members(id),

  declaration_text TEXT NOT NULL,
  conflicts JSONB NOT NULL, -- Array of {organization, relationship, nature}

  declared_at TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP NOT NULL, -- Must renew annually

  CONSTRAINT coi_unique_per_period UNIQUE(member_id, valid_until)
);

-- Board meetings
CREATE TABLE board_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  meeting_type VARCHAR(50) NOT NULL, -- 'quarterly_review', 'methodology_update', 'dispute_resolution', 'special'
  scheduled_at TIMESTAMP NOT NULL,

  -- Agenda & minutes
  agenda TEXT NOT NULL,
  minutes_draft TEXT,
  minutes_approved TEXT,
  minutes_approved_at TIMESTAMP,

  -- Attendance
  quorum_required INTEGER DEFAULT 5,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Meeting attendance
CREATE TABLE meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES board_meetings(id),
  member_id UUID NOT NULL REFERENCES advisory_board_members(id),

  status VARCHAR(50) NOT NULL, -- 'attended', 'absent_excused', 'absent_unexcused'
  notes TEXT,

  UNIQUE(meeting_id, member_id)
);

-- Methodology reviews (formal approval process)
CREATE TABLE methodology_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being reviewed
  review_type VARCHAR(50) NOT NULL, -- 'full_methodology', 'category_weights', 'test_cases', 'scoring_rubric'
  document_version VARCHAR(50) NOT NULL,
  document_url VARCHAR(500) NOT NULL,

  -- Review process
  submitted_at TIMESTAMP DEFAULT NOW(),
  submitted_by UUID REFERENCES users(id),

  -- Board decision
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'rejected', 'revision_requested'
  decision_at TIMESTAMP,
  decision_meeting_id UUID REFERENCES board_meetings(id),

  -- Votes
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  votes_abstain INTEGER DEFAULT 0,

  -- Feedback
  board_feedback TEXT,
  required_changes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual board member votes on reviews
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES methodology_reviews(id),
  member_id UUID NOT NULL REFERENCES advisory_board_members(id),

  vote VARCHAR(20) NOT NULL, -- 'approve', 'reject', 'abstain'
  reasoning TEXT,
  voted_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(review_id, member_id)
);

-- Transparency reports
CREATE TABLE transparency_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  report_period VARCHAR(20) NOT NULL, -- 'Q1-2026', 'Q2-2026', etc.
  report_type VARCHAR(50) NOT NULL, -- 'quarterly', 'annual', 'special'

  -- Content
  title VARCHAR(255) NOT NULL,
  executive_summary TEXT NOT NULL,
  full_report_url VARCHAR(500) NOT NULL,

  -- Approval
  approved_by_board BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMP,

  published_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Regulatory mappings
CREATE TABLE regulatory_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  regulation_name VARCHAR(255) NOT NULL, -- 'COPPA', 'EU AI Act', 'UK Online Safety Bill'
  regulation_version VARCHAR(50),
  jurisdiction VARCHAR(100) NOT NULL,

  -- Our compliance
  our_requirement_id VARCHAR(100), -- e.g., test case ID or category
  regulation_article VARCHAR(100), -- e.g., 'Article 5(1)(a)'
  compliance_status VARCHAR(50), -- 'compliant', 'partial', 'not_applicable', 'pending'

  notes TEXT,
  last_reviewed TIMESTAMP,
  reviewed_by UUID REFERENCES advisory_board_members(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Routes

```typescript
// Public routes
GET  /api/advisory-board                    // List active board members (public bios)
GET  /api/advisory-board/[id]               // Board member detail
GET  /api/transparency-reports              // List published reports
GET  /api/transparency-reports/[id]         // Report detail
GET  /api/regulatory-compliance             // Regulatory mapping summary

// Board member routes (authenticated board members only)
GET  /api/board/meetings                    // Upcoming meetings
GET  /api/board/meetings/[id]               // Meeting detail with agenda
POST /api/board/meetings/[id]/attendance    // Mark attendance
GET  /api/board/reviews                     // Pending methodology reviews
POST /api/board/reviews/[id]/vote           // Cast vote
POST /api/board/coi                         // Submit COI declaration

// Admin routes
POST   /api/internal/advisory-board         // Add board member
PATCH  /api/internal/advisory-board/[id]    // Update member
DELETE /api/internal/advisory-board/[id]    // Remove member
POST   /api/internal/meetings               // Schedule meeting
POST   /api/internal/reviews                // Submit for board review
POST   /api/internal/transparency-reports   // Create report draft
```

## UX Design

### Public: Advisory Board Page (/advisory-board)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ParentBench Logo]                                    Advisory Board    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🎓 Expert Advisory Board                                                │
│                                                                          │
│  Our methodology is reviewed and approved by independent experts         │
│  in child development, AI safety, law, and parent advocacy.              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  [Photo]  Dr. Sarah Chen                                           │ │
│  │           Chair, Child Development Expert                          │ │
│  │           Professor of Developmental Psychology, Stanford          │ │
│  │           Research focus: Children's cognitive development         │ │
│  │           and digital media exposure                               │ │
│  │           [LinkedIn]                                               │ │
│  │           COI: None declared                                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  [Photo]  Dr. Marcus Williams                                      │ │
│  │           AI Safety Researcher                                     │ │
│  │           Research Scientist, Anthropic (on leave)                 │ │
│  │           Publications on RLHF safety and child-specific alignment │ │
│  │           [LinkedIn]                                               │ │
│  │           COI: Former employer Anthropic (models evaluated)        │ │
│  │           → Recuses from Anthropic model scoring decisions         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [More board members...]                                                 │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  📋 Governance Documents                                                 │
│                                                                          │
│  • Board Charter [PDF]                                                   │
│  • Conflict of Interest Policy [PDF]                                     │
│  • Methodology Review Process [PDF]                                      │
│                                                                          │
│  📊 Transparency Reports                                                 │
│                                                                          │
│  • Q1 2026 Quarterly Report [PDF]                                        │
│  • 2025 Annual Report [PDF]                                              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Public: Regulatory Compliance Page (/regulatory-compliance)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Regulatory Alignment                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ParentBench methodology aligns with major child safety regulations.     │
│  Mapping reviewed quarterly by our Legal/Regulatory experts.             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🇺🇸 COPPA (Children's Online Privacy Protection Act)              │ │
│  │                                                                     │ │
│  │  Our "Data Privacy for Minors" category maps to:                   │ │
│  │  • §312.3 - Verifiable parental consent                            │ │
│  │  • §312.4 - Notice requirements                                    │ │
│  │  • §312.5 - Data minimization                                      │ │
│  │                                                                     │ │
│  │  Compliance: ✓ Full alignment                                       │ │
│  │  Last reviewed: March 2026 by [Legal Expert Name]                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🇪🇺 EU AI Act (High-Risk AI Systems)                              │ │
│  │                                                                     │ │
│  │  Our methodology addresses:                                        │ │
│  │  • Article 9 - Risk management (all categories)                    │ │
│  │  • Article 10 - Data governance (data privacy category)            │ │
│  │  • Article 14 - Human oversight (parental controls category)       │ │
│  │                                                                     │ │
│  │  Compliance: ⚠️ Partial (pending Article 52 transparency)          │ │
│  │  Last reviewed: March 2026 by [Legal Expert Name]                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [UK Online Safety Bill, KOSA, etc.]                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Board Member Portal (/board)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Advisory Board Portal                        Welcome, Dr. Chen [Logout] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📅 Upcoming Meetings                                                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Q2 2026 Quarterly Review                                          │ │
│  │  April 15, 2026 • 2:00 PM PT • Video Conference                   │ │
│  │                                                                     │ │
│  │  Agenda:                                                           │ │
│  │  1. Approve Q1 transparency report                                 │ │
│  │  2. Review: Adversarial Resistance category proposal               │ │
│  │  3. Discuss: Age stratification methodology                        │ │
│  │                                                                     │ │
│  │  [View Full Agenda] [Add to Calendar] [Join Meeting]               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  🗳️ Pending Reviews (2)                                                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Adversarial Resistance Category                                   │ │
│  │  Submitted: March 20, 2026                                         │ │
│  │  Type: New category proposal                                       │ │
│  │  Status: Awaiting your vote (5/9 voted)                           │ │
│  │                                                                     │ │
│  │  [View Document] [Cast Vote]                                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ⚠️ Action Required                                                     │
│                                                                          │
│  Your COI declaration expires in 30 days.                               │
│  [Update COI Declaration]                                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Admin: Methodology Review Submission

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Submit for Board Review                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Review Type:                                                            │
│  ○ Full Methodology Update                                               │
│  ● New Category Proposal                                                 │
│  ○ Category Weight Changes                                               │
│  ○ Test Case Batch (10+ cases)                                          │
│  ○ Scoring Rubric Change                                                 │
│                                                                          │
│  Document:                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  [Upload document or paste URL]                                    │ │
│  │  adversarial-resistance-v1.pdf                              ✓      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Version: v1.0-draft                                                     │
│                                                                          │
│  Summary for Board:                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Proposing a 5th category "Adversarial Resistance" to evaluate    │ │
│  │  model robustness against jailbreaks and manipulation attempts.   │ │
│  │  Weight: 20% (existing categories rebalanced). Includes ~50 test  │ │
│  │  cases covering jailbreaks, child-specific attacks, multi-turn.   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Target Meeting: Q2 2026 Quarterly Review (April 15)                     │
│                                                                          │
│  ┌─────────────────────┐                                                │
│  │  Submit for Review  │                                                │
│  └─────────────────────┘                                                │
│                                                                          │
│  Note: Submissions require 5/9 board votes to approve.                  │
│  Members with COI will be flagged to recuse.                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Peer Review Process

### Academic Publication Plan

1. **Target venue:** ACM FAccT (Fairness, Accountability, Transparency) or AAAI Workshop on AI Safety
2. **Paper structure:**
   - Problem: Gap in child-specific AI safety evaluation
   - Methodology: Category design, test case development, scoring
   - Validation: Expert review process, inter-rater reliability
   - Results: Initial model evaluations
   - Discussion: Limitations, future work

3. **Timeline:**
   - Draft: Internal review by advisory board
   - Submission: Conference deadline
   - Revision: Address reviewer feedback
   - Publication: Present at conference

### Pre-print Strategy

- Publish to arXiv for immediate visibility
- Invite public comment period (30 days)
- Incorporate feedback before formal submission

## Security Considerations

### Board Member Authentication
- SSO via institutional email where possible
- MFA required for all board accounts
- Session timeout: 4 hours
- IP logging for all board actions

### Conflict of Interest Enforcement
- System flags COI when member's declared organizations are involved
- Automatic recusal notification to member and chair
- Vote blocked until COI acknowledged

### Document Security
- Draft methodology documents: Board-only access
- Approved documents: Public
- Meeting minutes: Redacted version public, full version board-only

## E2E Test Plan

### Test: Board member listing
```typescript
test('public board page shows active members only', async () => {
  // Setup: active and inactive members
  await createBoardMember({ name: 'Active Expert', is_active: true });
  await createBoardMember({ name: 'Emeritus Expert', is_active: false });

  const response = await fetch('/api/advisory-board');
  const members = await response.json();

  expect(members.every(m => m.is_active)).toBe(true);
  expect(members.find(m => m.name === 'Active Expert')).toBeDefined();
  expect(members.find(m => m.name === 'Emeritus Expert')).toBeUndefined();
});
```

### Test: COI enforcement
```typescript
test('member with COI cannot vote on related review', async () => {
  const member = await createBoardMember({
    conflicts: [{ organization: 'Anthropic', relationship: 'former_employee' }]
  });

  const review = await createMethodologyReview({
    document: 'Claude model scoring update'
  });

  // System should detect COI
  const voteResponse = await castVote(review.id, member.id, 'approve');

  expect(voteResponse.status).toBe(403);
  expect(voteResponse.body.error).toContain('conflict of interest');
});
```

### Test: Methodology approval requires quorum
```typescript
test('review requires 5/9 votes to approve', async () => {
  const review = await createMethodologyReview();

  // 4 votes not enough
  for (let i = 0; i < 4; i++) {
    await castVote(review.id, members[i].id, 'approve');
  }

  let status = await getReviewStatus(review.id);
  expect(status).toBe('under_review');

  // 5th vote triggers approval
  await castVote(review.id, members[4].id, 'approve');

  status = await getReviewStatus(review.id);
  expect(status).toBe('approved');
});
```

### Test: Transparency report publication
```typescript
test('transparency report requires board approval before publish', async () => {
  const report = await createTransparencyReport({
    approved_by_board: false
  });

  // Cannot publish without approval
  const publishResponse = await publishReport(report.id);
  expect(publishResponse.status).toBe(400);

  // Approve and publish
  await approveReport(report.id);
  const publishResponse2 = await publishReport(report.id);
  expect(publishResponse2.status).toBe(200);

  // Verify public visibility
  const publicResponse = await fetch(`/api/transparency-reports/${report.id}`);
  expect(publicResponse.status).toBe(200);
});
```

### Test: Regulatory mapping display
```typescript
test('regulatory compliance page shows current mappings', async () => {
  await createRegulatoryMapping({
    regulation_name: 'COPPA',
    compliance_status: 'compliant'
  });

  const response = await fetch('/api/regulatory-compliance');
  const mappings = await response.json();

  expect(mappings.find(m => m.regulation_name === 'COPPA')).toBeDefined();
  expect(mappings[0].compliance_status).toBe('compliant');
});
```

## Acceptance Criteria

- [ ] Advisory board member profiles displayed publicly
- [ ] COI disclosures visible on member profiles
- [ ] Board member portal with meeting management
- [ ] Methodology review voting system
- [ ] Quorum enforcement (5/9 votes)
- [ ] COI auto-detection and recusal
- [ ] Transparency reports with board approval flow
- [ ] Regulatory mapping page
- [ ] Board charter and governance docs published
- [ ] MFA required for board accounts
- [ ] E2E tests for all flows

## Dependencies

- Authentication system (for board member login)
- Document storage (for reports, meeting minutes)
- Email notifications (meeting reminders, vote requests)

## Timeline

- **Month 1:** Board recruitment, charter drafting
- **Month 2:** Portal development, first meeting
- **Month 3:** First methodology review, transparency report
- **Ongoing:** Quarterly meetings, annual peer review paper

## Codex Review Fixes

### [CRITICAL FIX] COI Auto-Recusal — Structured Entity Linkage

```sql
-- NEW: Structured COI entities for programmatic recusal
CREATE TABLE coi_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES advisory_board_members(id),

  entity_type VARCHAR(50) NOT NULL, -- 'model_provider', 'model', 'regulation'
  entity_id UUID, -- FK to models or providers table if applicable
  organization_name VARCHAR(255) NOT NULL, -- For display
  relationship VARCHAR(100) NOT NULL, -- 'employer', 'consultant', 'investor', 'former_employee'
  nature TEXT, -- Additional context

  active BOOLEAN DEFAULT TRUE,
  declared_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(member_id, entity_type, organization_name)
);

-- Link methodology reviews to affected entities
ALTER TABLE methodology_reviews ADD COLUMN affected_entities JSONB;
-- Format: [{"type": "model_provider", "name": "Anthropic"}, ...]
```

COI auto-recusal now works by querying:
```sql
SELECT m.id FROM advisory_board_members m
JOIN coi_entities c ON m.id = c.member_id
WHERE c.entity_type = ANY(review.affected_entity_types)
AND c.organization_name = ANY(review.affected_entity_names)
AND c.active = true;
```

### [WARNING FIX] Dynamic Quorum Based on Active Members

```typescript
function calculateQuorum(reviewId: string): { required: number; eligible: number } {
  const activeMembers = await db.query.advisoryBoardMembers.findMany({
    where: and(
      eq(advisoryBoardMembers.isActive, true),
      notInArray(advisoryBoardMembers.id, getRecusedMemberIds(reviewId))
    )
  });

  const eligible = activeMembers.length;
  const required = Math.ceil(eligible * 0.55); // 55% majority of eligible

  return { required, eligible };
}
```

### [WARNING FIX] Public API View Model (No PII)

```typescript
// Public-safe board member view
interface PublicBoardMember {
  id: string;
  name: string;
  title: string;
  organization: string;
  expertiseArea: string;
  role: 'member' | 'chair' | 'emeritus';
  bio: string; // Sanitized, no contact info
  coiSummary: string; // "Has disclosed conflicts with AI providers" — not full text
  photoUrl?: string;
}

// Full member (board-only access)
interface FullBoardMember extends PublicBoardMember {
  email: string;
  termStart: Date;
  termEnd: Date;
  coiDeclarations: COIDeclaration[];
  // ...
}
```

### [WARNING FIX] Authorization Middleware

```typescript
// src/lib/auth/board-auth.ts
export function requireBoardRole(allowedRoles: ('board_member' | 'admin' | 'public')[]) {
  return async function(req: NextRequest) {
    const session = await getBoardSession(req);

    if (allowedRoles.includes('public')) return null;

    if (!session) return new Response('Unauthorized', { status: 401 });

    // MFA check for board members
    if (!session.mfaVerified && ['board_member', 'admin'].some(r => allowedRoles.includes(r))) {
      return new Response('MFA required', { status: 403 });
    }

    if (!allowedRoles.includes(session.role)) {
      return new Response('Forbidden', { status: 403 });
    }

    return null;
  };
}
```

### [WARNING FIX] Versioned Regulatory Mappings

```sql
ALTER TABLE regulatory_mappings ADD COLUMN methodology_version_id UUID REFERENCES methodology_versions(id);
ALTER TABLE regulatory_mappings ADD COLUMN effective_from DATE NOT NULL DEFAULT NOW();
ALTER TABLE regulatory_mappings ADD COLUMN effective_through DATE; -- NULL = current
ALTER TABLE regulatory_mappings ADD COLUMN requires_board_approval BOOLEAN DEFAULT TRUE;
```
