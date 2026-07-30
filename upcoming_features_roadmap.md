# MediaBasket Feature Roadmap

## Current Status (v0.1.0)

### Connectors (15)
- YouTube, Reddit, WhatsApp, Telegram, Instagram, Twitter/X
- Facebook, LinkedIn, TikTok, Discord, Slack, Mastodon
- Pinterest, Snapchat, Bluesky

### Core Modules
- Content Ingestion Pipeline (10 processors)
- Cross-Platform Search
- Content Scheduling
- Analytics Engine
- Rate Limiting
- Retry Logic
- Caching Layer

### API Routes (91)
- Auth (signup, login, me)
- Services (CRUD, sync)
- Content (list, detail)
- Moderation (approve, flag, delete)
- Search (cross-platform, filters)
- Analytics (summary, timeline, per-connector)
- Scheduler (schedule, publish, cancel)
- Webhooks (WhatsApp, Telegram)
- OAuth (YouTube, Reddit, Instagram, Twitter, Facebook, LinkedIn, TikTok, Pinterest, Snapchat)

---

## Upcoming Features

### Tier 1: Core UX (High Impact)

#### 1. Content Calendar
- **Description:** Visual calendar view for scheduled/published content
- **Components:**
  - `CalendarView.tsx` - Monthly/weekly/daily views
  - Drag-and-drop scheduling
  - Color-coded by platform
  - Quick add from calendar
- **API:** `GET /api/v1/orgs/{org_id}/calendar?month=2024-01`
- **Effort:** Medium (3-5 days)

#### 2. Bulk Operations
- **Description:** Select multiple items, moderate/publish/delete in batch
- **Components:**
  - `BulkSelect.tsx` - Checkbox selection
  - `BulkActions.tsx` - Action dropdown
  - Batch API calls with progress
- **API:** `POST /api/v1/orgs/{org_id}/bulk/moderate`, `POST /api/v1/orgs/{org_id}/bulk/publish`
- **Effort:** Medium (2-3 days)

#### 3. Content Templates
- **Description:** Pre-built templates for common post types
- **Components:**
  - `TemplateList.tsx` - Template gallery
  - `TemplateEditor.tsx` - Create/edit templates
  - Variable placeholders: `{{title}}`, `{{url}}`, `{{date}}`
- **API:** `GET/POST/PUT/DELETE /api/v1/orgs/{org_id}/templates`
- **Database:** `templates` table
- **Effort:** Low (1-2 days)

#### 4. Keyboard Shortcuts
- **Description:** Power user shortcuts
- **Shortcuts:**
  - `Ctrl+K` - Quick search
  - `Ctrl+N` - New post
  - `Ctrl+Shift+S` - Schedule
  - `Esc` - Close modal
  - `?` - Show shortcuts help
- **Implementation:** `useKeyboardShortcuts.ts` hook
- **Effort:** Low (1 day)

---

### Tier 2: Collaboration (Team Features)

#### 5. Task Assignment
- **Description:** Assign moderation tasks to team members
- **Components:**
  - `AssigneeSelect.tsx` - User picker
  - Task status tracking (assigned, in-progress, done)
- **API:** `POST /api/v1/orgs/{org_id}/content/{id}/assign`
- **Database:** `tasks` table
- **Effort:** Medium (2-3 days)

#### 6. Approval Workflow
- **Description:** Content approval before publishing
- **States:** draft → pending → approved → published
- **Components:**
  - `ApprovalBadge.tsx` - Status indicator
  - `ApprovalActions.tsx` - Approve/reject buttons
  - Notification on status change
- **API:** `POST /api/v1/orgs/{org_id}/content/{id}/approve`
- **Effort:** High (4-5 days)

#### 7. Activity Feed
- **Description:** Real-time team activity stream
- **Components:**
  - `ActivityFeed.tsx` - Live activity list
  - WebSocket for real-time updates
  - Filter by user/action type
- **API:** `GET /api/v1/orgs/{org_id}/activity`
- **Database:** `activity_log` table
- **Effort:** Medium (2-3 days)

#### 8. Internal Comments
- **Description:** Comment on content items (not public)
- **Components:**
  - `InternalComment.tsx` - Comment form
  - `CommentThread.tsx` - Threaded comments
  - @mention support
- **API:** `POST /api/v1/orgs/{org_id}/content/{id}/comments`
- **Database:** `internal_comments` table
- **Effort:** Low (1-2 days)

---

### Tier 3: Intelligence (AI/Analytics)

#### 9. AI Content Suggestions
- **Description:** Generate post ideas based on trending topics
- **Components:**
  - `ContentSuggestions.tsx` - Suggestion cards
  - Integration with OpenAI/Claude API
  - Based on: trending topics, past performance, optimal timing
- **API:** `GET /api/v1/orgs/{org_id}/suggestions`
- **Effort:** High (5-7 days)

#### 10. Competitor Monitoring
- **Description:** Track competitor accounts automatically
- **Components:**
  - `CompetitorList.tsx` - Competitor management
  - Periodic scraping (respecting ToS)
  - Competitive analysis dashboard
- **API:** `GET/POST /api/v1/orgs/{org_id}/competitors`
- **Database:** `competitors` table
- **Effort:** High (7-10 days)

#### 11. Sentiment Alerts
- **Description:** Alert when negative sentiment spikes
- **Components:**
  - `AlertConfig.tsx` - Alert threshold settings
  - Email/Slack/webhook notifications
  - Real-time monitoring
- **API:** `POST /api/v1/orgs/{org_id}/alerts`
- **Database:** `alerts` table
- **Effort:** Medium (3-4 days)

#### 12. ROI Tracking
- **Description:** Track clicks/conversions per post
- **Components:**
  - UTM parameter auto-generation
  - Link tracking (Bitly/custom)
  - Conversion attribution
- **API:** `GET /api/v1/orgs/{org_id}/analytics/roi`
- **Database:** `tracking_events` table
- **Effort:** Medium (3-4 days)

---

### Tier 4: Advanced (Power Features)

#### 13. Custom Dashboards
- **Description:** User-configurable dashboard widgets
- **Components:**
  - `DashboardBuilder.tsx` - Drag-and-drop widget placement
  - Widget library (charts, tables, lists)
  - Save/load dashboard configs
- **API:** `GET/POST/PUT /api/v1/orgs/{org_id}/dashboards`
- **Database:** `dashboards` table
- **Effort:** High (7-10 days)

#### 14. A/B Testing
- **Description:** Test different content variations
- **Components:**
  - `ABTestCreate.tsx` - Create test variants
  - Automatic winner selection
  - Statistical significance calculation
- **API:** `POST /api/v1/orgs/{org_id}/ab-tests`
- **Database:** `ab_tests` table
- **Effort:** High (5-7 days)

#### 15. Webhook Builder
- **Description:** Visual webhook configuration UI
- **Components:**
  - `WebhookBuilder.tsx` - Visual flow builder
  - Event selection (new post, comment, etc.)
  - Payload preview
- **API:** `GET/POST/PUT/DELETE /api/v1/orgs/{org_id}/webhooks`
- **Database:** `webhooks` table
- **Effort:** Medium (3-4 days)

#### 16. Data Export
- **Description:** Export analytics to CSV/PDF
- **Components:**
  - `ExportModal.tsx` - Export options
  - CSV generation
  - PDF report generation
- **API:** `GET /api/v1/orgs/{org_id}/export?format=csv`
- **Effort:** Low (1-2 days)

---

### Tier 5: Platform (Infrastructure)

#### 17. API Documentation
- **Description:** Interactive Swagger/OpenAPI docs
- **Implementation:**
  - FastAPI auto-generates OpenAPI
  - Add `/docs` and `/redoc` routes
  - Enhance docstrings
- **Effort:** Low (0.5 days)

#### 18. Mobile Responsive
- **Description:** Better mobile experience
- **Components:**
  - Responsive layout adjustments
  - Touch-friendly interactions
  - Mobile navigation
- **Effort:** Medium (3-4 days)

#### 19. Dark/Light Theme
- **Description:** Theme toggle
- **Components:**
  - `ThemeToggle.tsx` - Switch component
  - CSS variables for theming
  - Persist preference in localStorage
- **Effort:** Low (1 day)

#### 20. Audit Log
- **Description:** Track all user actions
- **Components:**
  - Automatic logging middleware
  - `AuditLog.tsx` - Log viewer
  - Filter by user/action/time
- **API:** `GET /api/v1/orgs/{org_id}/audit-log`
- **Database:** `audit_log` table
- **Effort:** Medium (2-3 days)

---

## Database Schema Additions

### Templates
```sql
CREATE TABLE templates (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(255),
    content TEXT,
    variables JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Tasks
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    content_item_id UUID REFERENCES content_items(id),
    assigned_to UUID REFERENCES members(id),
    status VARCHAR(50),
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

### Activity Log
```sql
CREATE TABLE activity_log (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES members(id),
    action VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP
);
```

### Internal Comments
```sql
CREATE TABLE internal_comments (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    content_item_id UUID REFERENCES content_items(id),
    user_id UUID REFERENCES members(id),
    body TEXT,
    created_at TIMESTAMP
);
```

### Competitors
```sql
CREATE TABLE competitors (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    connector_type VARCHAR(50),
    external_id VARCHAR(255),
    display_name VARCHAR(255),
    metadata JSONB,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### Alerts
```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(255),
    type VARCHAR(50),
    config JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### Webhooks
```sql
CREATE TABLE webhooks (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    url VARCHAR(500),
    events TEXT[],
    secret VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
);
```

---

## Implementation Order

### Phase 1: Quick Wins (1-2 weeks)
1. API Documentation (#17)
2. Keyboard Shortcuts (#4)
3. Dark/Light Theme (#19)
4. Content Templates (#3)
5. Data Export (#16)

### Phase 2: Core UX (2-3 weeks)
1. Content Calendar (#1)
2. Bulk Operations (#2)
3. Internal Comments (#8)
4. Activity Feed (#7)

### Phase 3: Collaboration (2-3 weeks)
1. Task Assignment (#5)
2. Approval Workflow (#6)
3. Audit Log (#20)

### Phase 4: Intelligence (3-4 weeks)
1. Sentiment Alerts (#11)
2. ROI Tracking (#12)
3. AI Content Suggestions (#9)

### Phase 5: Advanced (4-5 weeks)
1. Custom Dashboards (#13)
2. Webhook Builder (#15)
3. A/B Testing (#14)
4. Competitor Monitoring (#10)

---

## Dependencies

- Phase 1: None
- Phase 2: None
- Phase 3: Activity Log (#20) for audit trail
- Phase 4: Analytics Engine (existing)
- Phase 5: Templates (#3) for A/B testing

---

## Estimated Total Effort

- Phase 1: 5-7 days
- Phase 2: 8-12 days
- Phase 3: 8-10 days
- Phase 4: 11-15 days
- Phase 5: 16-22 days

**Total: 48-66 days (10-14 weeks)**

---

## Notes

- All new features should follow existing patterns (ServicePanel, ContentDetail)
- Use standardized API responses (`api_response.py`)
- Include rate limiting for new endpoints
- Add caching for expensive queries
- Write tests for new functionality
