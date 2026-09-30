<!-- ------------------------------------------------------------------------ -->
<!-- This is the governing product specification for Free Pool Radar. -->
<!-- The earlier schema-shaped PRODUCT.md was replaced by it on 2026-09-29:  -->
<!-- it described a light-theme default and seven polled providers, both of  -->
<!-- which contradicted what the product had actually built (A43 sets dark    -->
<!-- as the default). PRODUCT_ALIGN.md is kept as a pointer to this file so   -->
<!-- there is exactly one source of truth.                                   -->
<!-- ------------------------------------------------------------------------ -->

# Free Pool Radar

> **The live intelligence layer for free AI inference.**

A continuously updated web application that discovers, verifies, monitors, categorizes, and historically tracks genuinely free AI API access — including shared token pools, free model endpoints, sponsored inference, promotional credits, keyless access, rotating free models, and temporary community events.

The product must clearly distinguish **currently usable free access**, **upcoming access**, **changed access**, and **ended/withdrawn access**.

The application must be deployable publicly and must update its data automatically without requiring a frontend redeployment.

---

# 1. PRODUCT IDENTITY

## Product name

**Free Pool Radar**

## Primary tagline

**Every free AI inference pool. Every disappearing quota. One live radar.**

## Supporting statement

> Discover free AI inference before everyone else does.
> We monitor shared pools, free model endpoints, sponsored access, promotional credits, and disappearing free tiers — and keep the history when they disappear.

## Category

AI infrastructure intelligence / AI developer intelligence.

## Primary users

1. AI developers
2. AI agent builders
3. Open-source developers
4. AI power users
5. Researchers
6. People building with OpenCode / Claude Code / Codex / Cursor / similar tools
7. Developers looking for temporary or permanent $0 inference
8. Developers looking for alternative model providers

## Product principle

> **"Free" is not a category. It's a claim we verify.**

The application must never casually label an offer as "free" without showing what kind of free access it actually is.

---

# 2. CORE PRODUCT PROMISE

The application answers these questions immediately:

* What AI API access is free right now?
* Which frontier/strong models can currently be accessed for $0?
* Which providers require no subscription?
* Which providers require no payment method?
* Which providers provide shared token pools?
* Which pools are starting soon?
* How many tokens/requests/credits are available?
* When does the offer start?
* When does it end?
* What happens when the pool is exhausted?
* Which models are currently free?
* Which models became free recently?
* Which free offers changed?
* Which free offers disappeared?
* When was each offer last verified?
* Where is the official evidence?
* Is the offer permanent, temporary, promotional, sponsored, or shared?
* Can developers use an API key?
* Is the endpoint OpenAI-compatible?
* Is the endpoint Anthropic-compatible?
* What are the rate limits?
* Are there data/privacy restrictions?
* Is a credit card required?
* Is registration required?
* Is the offer official or an unofficial gateway?

---

# 3. NON-GOALS

Do NOT build:

* a generic AI model directory
* a generic "best AI models" ranking website
* an AI chatbot
* a model benchmark leaderboard
* an affiliate-heavy coupon website
* a page that republishes third-party lists without verification
* a website that calls every temporary trial "free"
* a system that invents missing token quotas
* a system that silently deletes expired offers
* a system requiring frontend redeployment whenever data changes

Do not rank providers as "best", "worst", "#1", etc.

The product presents factual intelligence and lets users decide.

---

# 4. ACCESS TAXONOMY

Every discovered offer MUST belong to one or more explicit access types.

## 4.1 Shared Pool

A community/shared allocation where multiple users consume from the same token/request pool.

Example:

```text
APMix
5B shared token pool
No subscription
No payment
API key required
Pool terminates when exhausted
```

## 4.2 Permanent Free Tier

A provider's normal API includes a free quota.

Typical limits:

* requests/day
* requests/minute
* tokens/minute
* tokens/day
* monthly quota
* model-specific quota

## 4.3 Rotating Free Model

A gateway periodically makes different models available for $0.

## 4.4 Sponsored Inference

A third party funds inference.

Track:

* sponsor
* funding amount if publicly available
* remaining allocation if available
* supported models
* expiration
* usage restrictions

## 4.5 Promotional Event

Temporary event.

Track:

* event start
* event end
* pool size
* participating models
* eligibility
* exhaustion conditions

## 4.6 Free Credits

Examples:

```text
$5 free credit
$10 monthly credit
$0.10 inference credit
```

These MUST NOT be displayed as equivalent to unlimited/free-token access.

## 4.7 Keyless Access

API endpoint usable without obtaining an API key.

## 4.8 Free Trial

Temporary trial.

Track:

* duration
* trial amount
* models
* registration requirements
* card requirement

## 4.9 Ended

Historical record of an offer that previously existed but no longer qualifies.

---

# 5. CRITICAL DISTINCTIONS

The UI MUST distinguish:

```text
FREE
FREE WITH CARD
FREE CREDIT
FREE TRIAL
SHARED POOL
KEYLESS
RATE LIMITED
TEMPORARY
ENDED
UNVERIFIED
```

Never collapse these into one "Free" badge.

---

# 6. STATUS MODEL

Every offer has exactly one primary status:

```text
UPCOMING
LIVE
CHANGED
ENDING
EXHAUSTED
ENDED
SUSPENDED
UNVERIFIED
```

## UPCOMING

Officially announced but not started.

## LIVE

Currently verified as usable.

## CHANGED

Existing offer whose important properties changed.

The offer may still be usable.

## ENDING

Officially known to have an upcoming end date.

## EXHAUSTED

Shared pool reached its allocation limit.

## ENDED

Free access is no longer available.

## SUSPENDED

Provider temporarily disabled access.

## UNVERIFIED

Discovered but insufficient official evidence exists.

Unverified offers must never appear alongside verified offers without an explicit visual distinction.

---

# 7. DATA MODEL

Create a database with at least the following entities.

---

## 7.1 providers

```text
id
name
slug
official_url
logo_url
description
provider_type
country
status
created_at
updated_at
last_verified_at
```

---

## 7.2 models

```text
id
provider_id
model_id
display_name
family
parameter_count
context_window
capabilities
official_model_url
created_at
updated_at
```

---

## 7.3 offers

```text
id
provider_id
model_id
offer_type
status

access_requires_account
access_requires_subscription
payment_required
card_required
api_key_required
keyless

compatibility_openai
compatibility_anthropic
compatibility_other

token_limit
request_limit
rpm
rpd
tpm
tpd
monthly_limit

pool_size
pool_remaining

credit_amount
credit_currency

start_at
end_at
exhaustion_condition

commercial_use
data_policy
retention_policy

official_evidence_url
secondary_evidence_url

first_discovered_at
first_verified_at
last_verified_at
last_seen_live_at
ended_at

confidence
verification_level

created_at
updated_at
```

---

## 7.4 events

Used for shared pools/promotional events.

```text
id
provider_id
name
slug
description

status

start_at
end_at

pool_size
pool_remaining
unit

models

eligibility
requirements
exhaustion_condition

official_url

announced_at
discovered_at
last_verified_at

created_at
updated_at
```

---

## 7.5 observations

Every monitoring sweep creates observations.

```text
id
provider_id
offer_id
event_id

observed_at

status
raw_status

token_limit
pool_remaining
rpm
rpd
tpm
tpd

model_count

source_url
source_type

response_hash
raw_payload

verification_level
```

Do not overwrite historical observations.

---

## 7.6 changes

Every meaningful change creates a change event.

```text
id

provider_id
offer_id
event_id

change_type

field
old_value
new_value

detected_at
effective_at

source_url
evidence

severity
```

Change types:

```text
NEW
MODEL_ADDED
MODEL_REMOVED
QUOTA_INCREASED
QUOTA_DECREASED
POOL_STARTED
POOL_EXHAUSTED
POOL_EXTENDED
POOL_CANCELLED
PRICE_CHANGED
CARD_REQUIRED
CARD_REMOVED
SUBSCRIPTION_REQUIRED
SUBSCRIPTION_REMOVED
FREE_TIER_STARTED
FREE_TIER_ENDED
RATE_LIMIT_CHANGED
STATUS_CHANGED
```

---

# 8. VERIFICATION SYSTEM

This is a core product feature.

Every factual claim should have evidence.

## Evidence hierarchy

### Level 1 — Live API

Highest confidence.

Examples:

* public models endpoint
* quota endpoint
* public JSON endpoint
* provider API response

### Level 2 — Official provider documentation

### Level 3 — Official event page

### Level 4 — Official announcement/blog/changelog

### Level 5 — Official social announcement

### Level 6 — reputable secondary source

### Level 7 — community discovery

Secondary/community sources can DISCOVER an offer but should not automatically make it verified.

---

# 9. VERIFICATION RULE

Every important numeric field must store:

```text
value
source_url
observed_at
evidence
verification_level
```

Never invent:

* token limits
* expiration dates
* rate limits
* model availability
* credit amounts
* remaining pool sizes

If unavailable:

```text
Not publicly stated
```

or:

```text
Not disclosed
```

Never substitute a guessed number.

---

# 10. SOURCE REGISTRY

Create a configurable source registry.

Example:

```json
{
  "provider": "APMix",
  "officialUrl": "https://apmix.ai",
  "sources": [
    {
      "url": "https://apmix.ai/event",
      "type": "event",
      "priority": 1
    }
  ],
  "monitoring": {
    "intervalHours": 5
  }
}
```

The source registry must be data-driven.

Adding a provider should NOT require modifying frontend components.

---

# 11. MONITORING SYSTEM

The monitoring system runs independently of the frontend.

Target frequency:

**Every 5 hours.**

The frontend is NOT redeployed when data changes.

Architecture:

```text
Scheduled Worker
      ↓
Source Collectors
      ↓
Normalizer
      ↓
Verifier
      ↓
Change Detector
      ↓
Database
      ↓
Frontend reads current data
```

Recommended infrastructure:

* Vercel for frontend
* Supabase/Postgres for persistent data
* Cloudflare Worker for scheduled monitoring
* GitHub for source control
* Vercel deployment for frontend

The implementation may use equivalent free infrastructure if necessary, but must preserve the architecture.

---

# 12. MONITORING REQUIREMENTS

Every sweep must:

1. Fetch every active source.
2. Record HTTP status.
3. Record response time.
4. Parse relevant data.
5. Normalize provider/model information.
6. Compare with previous observation.
7. Detect additions.
8. Detect removals.
9. Detect quota changes.
10. Detect status changes.
11. Detect start/end changes.
12. Store observation — but only when a collected value actually changed. A sweep
    whose payload is byte-identical to the stored one appends nothing and only
    refreshes `last_verified_at` (item 15). This is deliberate: it is what stops
    a five-hourly schedule from manufacturing history that never happened.
13. Store changes.
14. Update current status.
15. Update `last_verified_at`.
16. Record failures.
17. Never delete historical data.

---

# 13. SOURCE HEALTH

Track:

```text
● LIVE
● SLOW
● DEGRADED
● FAILED
● STALE
```

Display:

```text
12 / 14 sources responding
Last sweep:
28 Sep 2026 · 12:30 UTC
Next sweep:
17:30 UTC
```

If a source fails:

Do NOT mark its offers as ended.

Instead:

```text
SOURCE UNAVAILABLE

Last successful verification:
28 Sep 2026 · 07:30 UTC
```

This distinction is critical.

---

# 14. DATA FRESHNESS

Every offer must display:

```text
Verified 23 minutes ago
```

or:

```text
Last verified:
28 Sep 2026 · 12:30 UTC
```

Freshness states:

```text
< 6h       FRESH
6–24h      AGING
24–72h     STALE
> 72h      VERY STALE
```

The UI should make stale information obvious.

---

# 15. CHANGE DETECTION

The system must compare snapshots.

Example:

Previous:

```text
pool_size = 5B
models = 3
card_required = false
```

Current:

```text
pool_size = 5B
models = 2
card_required = false
```

Create:

```text
MODEL_REMOVED
```

If:

```text
card_required
false → true
```

create:

```text
CARD_REQUIRED
```

---

# 16. HISTORICAL DATA

Never delete an offer because it ended.

Example:

```text
APMix
────────────────

LIVE
5B token pool

History

02 Oct 2026
Pool opened

...

12 Oct 2026
Pool exhausted

Status:
EXHAUSTED
```

The site should become more useful over time.

---

# 17. LANDING PAGE

The homepage must feel like:

**Bloomberg terminal × aerospace radar × modern AI infrastructure.**

Do NOT make it look like:

* generic SaaS
* excessive rounded cards
* gradient blobs
* AI-generated startup template
* excessive purple gradients
* cartoon illustrations

Visual character:

* cinematic
* technical
* editorial
* premium
* dark-first
* information-dense
* restrained
* precise
* futuristic without looking childish

---

# 18. HERO SECTION

Hero must immediately communicate:

```text
FREE POOL RADAR

Every free AI inference pool.
Every disappearing quota.
One live radar.
```

Primary visual:

A large animated radar/tide/pulse visualization.

It should represent:

* live providers
* upcoming events
* pool capacity
* model availability
* signal strength

Example live ticker:

```text
● LIVE

APMIX
5.00B TOKEN POOL
STARTS IN 2D 03H

NVIDIA
38 FREE ENDPOINTS

OPENROUTER
21 FREE MODEL IDS

GROQ
FREE API
RATE LIMITED
```

Hero statistics:

```text
113
FREE MODEL IDS

42
CARDLESS PROVIDERS

12
LIVE SOURCES

9
WITHDRAWN OFFERS
```

These numbers must come from the database.

Never hard-code them.

---

# 19. LIVE SIGNAL SECTION

Title:

```text
LIVE SIGNAL
```

Show:

* source count
* live provider count
* free model count
* active pools
* upcoming pools
* newly discovered offers
* ended offers
* last sweep
* next sweep

---

# 20. STARTING SOON

Show upcoming events.

Each card:

```text
APMIX

GPT-6-LUNA-FREE

5.00B TOKENS

STARTS IN
2D 03H 14M

NO SUBSCRIPTION
NO PAYMENT

02 OCT 2026
17:00 UTC

VIEW EVENT →
```

Sort chronologically.

---

# 21. LIVE NOW

Show currently usable free access.

Each entry should show:

```text
Provider
Model
Access type
Pool/quota
Card requirement
Subscription requirement
Rate limit
Compatibility
Last verified
Official source
```

Filters:

```text
All
Shared Pools
Free APIs
Keyless
Sponsored
Credits
Frontier
OpenAI Compatible
Anthropic Compatible
```

---

# 22. NEW

Show offers discovered since the previous monitoring cycle.

Example:

```text
NEW · 28 SEP

APMix launches shared pool

GPT-6-Luna-Free

5B weighted tokens

Discovered:
12:30 UTC
```

---

# 23. CHANGED

Show important modifications.

Example:

```text
CHANGED

Provider X

Free models
12 → 15

+3 models

Verified:
12:30 UTC
```

Another:

```text
CARD REQUIREMENT CHANGED

Provider Y

NO CARD
↓
CARD REQUIRED
```

---

# 24. ENDED

This section is mandatory.

Display historical offers.

Example:

```text
ENDED

CHUTES.AI

Free tier retired

15 MAR 2026

Reason:
Provider documentation states free tier was retired.

Official evidence →
```

Never delete historical entries.

---

# 25. MODEL INDEX

Searchable model database.

Columns:

```text
MODEL
PROVIDER
ACCESS
STATUS
LIMIT
CARD
LAST VERIFIED
```

Search examples:

```text
Claude
GPT
Gemini
Qwen
Llama
DeepSeek
Mistral
Nemotron
GLM
Kimi
```

Do not assume these models are free.

Only show them if verified.

---

# 26. PROVIDER INDEX

Each provider gets a page.

Provider page:

```text
Provider name
Official website
Current status
Free offers
Models
Rate limits
Card requirement
Subscription requirement
Compatibility
Current events
Historical events
Last verification
Source health
Change history
```

---

# 27. MODEL DETAIL PAGE

For every model:

```text
MODEL NAME

Providers currently offering free access

Provider
Access type
Quota
Card requirement
Subscription
API compatibility
Last verified

Historical providers

Provider
Ended
Date
Reason/evidence
```

---

# 28. TIMELINE

Global timeline.

Example:

```text
SEP 28

● APMix 5B pool announced

SEP 27

● Provider X added 3 free models

SEP 26

● Provider Y removed free access

SEP 22

● Provider Z became card-required
```

Filter:

```text
All
New
Model changes
Quota changes
Free tier changes
Pools
Ended
```

---

# 29. COMPARE

Users can select providers.

Comparison must be factual.

Example:

```text
                   APMix    Groq    NVIDIA

Free access        Yes      Yes     Yes
Shared pool        Yes      No      No
Card required      No       No      No
Subscription       No       No      No
API key            Yes      Yes     Yes
OpenAI compatible  Yes      Yes     Yes
Models             3        12      38
Rate limit         ...
```

Do not create a winner/ranking.

---

# 30. SEARCH

Global search.

Search across:

* providers
* models
* offers
* events
* historical changes

Search examples:

```text
"claude"
"5B pool"
"no card"
"keyless"
"Qwen"
"shared"
```

---

# 31. FILTER SYSTEM

Filters:

```text
Status
Provider
Model
Access type
Card required
Subscription required
API key required
Keyless
OpenAI compatible
Anthropic compatible
Pool size
Token limit
Request limit
Temporary/permanent
Freshness
```

---

# 32. SORTING

Allow:

```text
Recently verified
Recently discovered
Starting soon
Largest pool
Most models
Recently changed
Recently ended
```

Do not label a sorting order as a quality ranking.

---

# 33. SOURCE METHODOLOGY SECTION

Explain:

```text
HOW WE VERIFY

1. Live API first
2. Official documentation second
3. Official announcements
4. Secondary sources for discovery
5. Every important number is evidence-backed
6. Conflicts are preserved instead of silently resolved
7. Failed monitoring does not mean an offer ended
```

---

# 34. TRUST / CONFIDENCE

Use:

```text
VERIFIED
OFFICIAL SOURCE
LIVE OBSERVATION
STALE
UNVERIFIED
```

Do not use fake numerical "trust scores".

---

# 35. DISCLAIMER

Use factual language.

Example:

> Free access can be withdrawn, rate-limited, modified, or exhausted without notice. Always review the provider's current terms, privacy policy, and usage restrictions before sending sensitive or production data.

Also:

> Free Pool Radar is an independent information service and is not affiliated with the providers listed.

---

# 36. PRIVACY / SECURITY

Never collect users' provider API keys.

The public application does not need users' API keys.

If user accounts are added later, store only:

```text
email
preferences
alerts
saved providers
saved models
```

Never store third-party API credentials unless a future feature explicitly requires secure credential storage.

---

# 37. API

Expose a future public API.

Endpoints:

```text
GET /api/providers
GET /api/providers/:slug
GET /api/models
GET /api/models/:slug
GET /api/offers
GET /api/events
GET /api/changes
GET /api/live
GET /api/upcoming
GET /api/ended
```

Example:

```json
{
  "provider": "APMix",
  "model": "gpt-6-luna-free",
  "status": "upcoming",
  "offerType": "shared_pool",
  "poolSize": 5000000000,
  "cardRequired": false,
  "subscriptionRequired": false,
  "lastVerifiedAt": "2026-09-28T12:30:00Z",
  "source": "https://apmix.ai/event"
}
```

---

# 38. FUTURE ALERTS

Design the architecture so alerts can later support:

```text
Email
Telegram
Discord
Webhook
Push notification
RSS
```

User rules:

```text
Alert me when:

Claude becomes free

A shared pool > 1B tokens appears

A new cardless provider appears

A frontier model becomes free

A provider removes a card requirement

A tracked provider changes its quota

A pool is starting within 24h
```

---

# 39. FUTURE PRO FEATURES

Potential paid functionality:

```text
Advanced alerts
Historical analytics
API access
CSV/JSON export
Webhook alerts
Custom monitoring
Provider watchlists
Model watchlists
Slack/Discord alerts
Telegram alerts
Team accounts
Change history beyond public window
```

Do not implement paid billing in MVP.

Build the architecture so it can be added later.

---

# 40. SEO

Every provider/model/event should have an indexable page.

Examples:

```text
/providers/apmix
/providers/groq
/providers/nvidia

/models/gpt-6-luna-free
/models/qwen3
/models/llama

/events/apmix-gpt-6-luna
```

Metadata must be generated dynamically.

Example:

```text
Title:
APMix Free AI API Pool — 5B Tokens | Free Pool Radar

Description:
Current status, token pool, models, requirements, start date,
and verification history for the APMix free AI API event.
```

---

# 41. TECHNOLOGY

Preferred:

```text
Frontend:
Next.js
TypeScript
Tailwind CSS

UI:
shadcn/ui where appropriate

Charts:
Lightweight custom SVG/canvas visualizations

Database:
Supabase PostgreSQL

Scheduled monitoring:
Cloudflare Workers Cron

Hosting:
Vercel

Source:
GitHub
```

Use stable current versions.

Do not introduce unnecessary dependencies.

---

# 42. RESPONSIVE REQUIREMENTS

Must work beautifully on:

* desktop
* laptop
* tablet
* mobile

Mobile is NOT a compressed desktop.

The radar hero should adapt.

Tables should become cards or horizontally scrollable data views.

Navigation should become a compact mobile navigation.

---

# 43. DARK / LIGHT MODE

Default:

**Dark cinematic mode.**

Support light mode.

Use persistent preference.

Dark theme should feel like:

```text
black
graphite
deep navy
muted grey
off-white
signal green
amber
red
```

Avoid excessive neon.

Use accent colors only to convey state:

```text
Green = live
Amber = upcoming/change
Red = ended/problem
Grey = stale
Blue/white = neutral information
```

---

# 44. TYPOGRAPHY

Use a professional technical typography system.

Recommended:

```text
Primary:
Inter / Geist / Archivo

Monospace:
JetBrains Mono
```

Large hero typography should be bold and editorial.

Numbers should use monospace or tabular figures.

---

# 45. MOTION

Motion must feel like instrumentation.

Use:

* slow radar sweep
* subtle pulse
* data ticks
* number transitions
* countdowns
* status transitions
* chart movement

Avoid:

* excessive bouncing
* floating blobs
* cartoon animation
* constant parallax
* distracting gradients

Respect:

```text
prefers-reduced-motion
```

---

# 46. PERFORMANCE

Target:

```text
Lighthouse Performance > 90
Accessibility > 90
SEO > 90
Best Practices > 90
```

Do not load large animation libraries unnecessarily.

Use CSS/SVG/canvas where possible.

---

# 47. ACCESSIBILITY

Must support:

* keyboard navigation
* semantic HTML
* visible focus
* screen-reader labels
* sufficient contrast
* reduced motion
* accessible tables
* accessible status indicators

Do not communicate status only using color.

---

# 48. MOBILE HERO

On mobile:

```text
FREE
AI
ACCESS

LIVE RADAR
```

Then:

```text
113 free models
42 cardless providers
12 live sources
```

Then upcoming event.

Do not force a huge desktop visualization into a tiny viewport.

---

# 49. DATA UPDATE UX

The page should NOT require reload/redeploy to receive updated information.

On page load:

```text
GET latest database snapshot
```

Show:

```text
Updated 2h 14m ago
```

Optional client-side refresh:

```text
every 5 minutes
```

This is only frontend data refresh.

The authoritative monitoring process remains every 5 hours.

---

# 50. MONITORING DASHBOARD

Create an internal/admin route:

```text
/admin
```

Protected.

Display:

```text
SOURCE HEALTH

APMix             ● 200   236ms
OpenRouter        ● 200   298ms
NVIDIA            ● 200   421ms
Groq              ● 200   318ms
...
```

Also:

```text
Last sweep
Next sweep
Successful sources
Failed sources
New offers
Changed offers
Ended offers
```

---

# 51. ADMIN SOURCE MANAGEMENT

Admin should be able to:

```text
Add provider
Edit provider
Add source
Disable source
Enable source
Set source priority
Change monitoring frequency
Mark source as official
Review failed sources
Review unverified discoveries
```

Do not hard-code provider lists into React components.

---

# 52. DISCOVERY QUEUE

Create:

```text
/discovery
```

Internal only.

Candidates:

```text
Potential new provider
Potential free model
Potential shared pool
Potential ended offer
```

Each candidate:

```text
Discovered from
Date
URL
Evidence
AI classification
Verification status
```

Admin can:

```text
Verify
Reject
Investigate
Merge
```

---

# 53. AI RESEARCH AGENT

The monitoring architecture should eventually support an AI research worker.

Input:

```text
candidate URL
provider
source content
previous state
```

Output structured JSON:

```json
{
  "isRelevant": true,
  "offerType": "shared_pool",
  "provider": "APMix",
  "models": ["gpt-6-luna-free"],
  "poolSize": 5000000000,
  "startAt": "...",
  "endAt": null,
  "cardRequired": false,
  "subscriptionRequired": false,
  "confidence": 0.98,
  "evidence": []
}
```

The AI must NOT be the ultimate authority.

Official evidence remains authoritative.

---

# 54. CONFLICT HANDLING

If sources disagree:

Do not silently select one.

Display:

```text
SOURCE CONFLICT

Provider documentation:
100 RPM

API response:
60 RPM

Last checked:
28 Sep 2026
```

Store both observations.

Flag for review.

---

# 55. RATE LIMITS

Track all available dimensions:

```text
RPM
RPD
TPM
TPD
monthly tokens
monthly requests
concurrency
burst
```

Do not convert one metric into another unless explicitly documented.

---

# 56. TOKEN ACCOUNTING

Never assume:

```text
1 request = 1 token
```

Track units exactly as published:

```text
tokens
weighted tokens
requests
credits
neurons
GPU seconds
dollars
```

Display the original unit.

If a provider uses weighted tokens:

```text
5B weighted tokens
```

not:

```text
5B tokens
```

---

# 57. FREE ACCESS SCORE

Do NOT create a provider quality score.

Do not rank providers.

Instead expose factual dimensions:

```text
Pool size
Model count
Card requirement
Subscription requirement
Freshness
Rate limit
Access type
Compatibility
```

Users can make their own decision.

---

# 58. INITIAL PROVIDER DISCOVERY

The first research sweep should investigate broadly.

Include categories such as:

```text
AI model vendors
AI gateways
AI inference platforms
community gateways
sponsored inference
developer programs
open model platforms
GPU providers
API aggregators
AI coding platforms
temporary model events
community token pools
```

Known examples to investigate include:

```text
APMix
AIHubMix
OpenRouter
NVIDIA NIM / build.nvidia.com
Groq
Google Gemini
Cohere
Hugging Face
Cloudflare Workers AI
OpenCode Zen
Pollinations
FreeTheAI
sponsored inference services
community pools
```

These are discovery starting points, NOT guaranteed free offers.

Every entry must be independently verified before publication.

---

# 59. OFFICIAL URL POLICY

Every provider must have an official URL.

Never use:

```text
random aggregator URL
affiliate URL
URL shortener
unverified mirror
```

for the primary provider link.

Secondary sources may exist separately.

---

# 60. EXTERNAL LINK POLICY

External links should clearly indicate:

```text
Official source →
```

or:

```text
Documentation →
```

or:

```text
Event →
```

Never disguise a third-party URL as an official provider URL.

---

# 61. SECURITY

Never expose:

* database service keys
* Supabase service role
* monitoring credentials
* private admin credentials
* API keys
* worker secrets

Use environment variables.

Example:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

CRON_SECRET
```

Never commit secrets.

---

# 62. ENVIRONMENT

Provide:

```text
.env.example
```

with all required variables.

The project must work locally with documented setup.

---

# 63. LOCAL DEVELOPMENT

Required commands:

```bash
npm install
npm run dev
```

or equivalent package manager.

The README must explain:

```text
1. Clone repository
2. Install dependencies
3. Configure .env
4. Run database migrations
5. Seed development data
6. Start development server
```

---

# 64. SEED DATA

Provide development seed data containing:

* at least 10 providers
* at least 20 offers
* at least 10 models
* at least 5 historical changes
* at least 5 ended offers
* at least 3 upcoming events

Seed data must be clearly marked as development data.

Production must never display fake seed data.

---

# 65. ERROR STATES

Every important UI must have:

```text
Loading
Empty
Error
Stale
Unavailable
```

Example:

```text
NO VERIFIED OFFERS

We haven't found a currently verified offer matching these filters.
```

Do not fabricate data to fill empty states.

---

# 66. OFFLINE / SOURCE FAILURE

If monitoring stops:

The website continues showing the last verified dataset.

Display:

```text
DATA MAY BE STALE

Last successful sweep:
28 Sep 2026 · 12:30 UTC
```

Never replace data with blanks.

---

# 67. DATABASE RETENTION

Do not delete observations.

Historical observations are part of the product moat.

Potential future retention tiers may be introduced later, but MVP should preserve full history.

---

# 68. API CACHE

Public data may be cached.

Use:

```text
ISR
server-side caching
database indexes
edge caching
```

where appropriate.

But never allow stale cache to conceal a newer verified status indefinitely.

---

# 69. DATABASE INDEXES

At minimum index:

```text
providers.slug
offers.status
offers.provider_id
offers.model_id
offers.last_verified_at
offers.start_at
offers.end_at
models.slug
events.status
events.start_at
changes.detected_at
observations.observed_at
```

---

# 70. UI COMPONENTS

Create reusable components:

```text
RadarHero
LiveSignal
StatusBadge
ProviderBadge
ModelBadge
OfferCard
PoolCard
UpcomingCard
ChangeCard
EndedCard
SourceHealth
FreshnessIndicator
Countdown
ModelTable
ProviderTable
Timeline
FilterBar
SearchBar
CompareTable
EvidencePanel
VerificationBadge
```

Components should consume structured data.

---

# 71. RADAR VISUAL

The radar should not be a decorative fake animation.

Where possible, its visual signals should represent real data.

For example:

```text
ring = token pool scale
point = provider
brightness = freshness
pulse = recently changed
arc = upcoming event
```

If the data is unavailable, use a neutral idle state.

---

# 72. HERO TIDE / POOL VISUAL

For shared pools, optionally visualize:

```text
POOL CAPACITY
████████████████████░░░░
80%
```

For upcoming:

```text
NOT STARTED
──────────────
STARTS
02 OCT · 17:00 UTC
```

For exhausted:

```text
EXHAUSTED
POOL DEPLETED
```

---

# 73. TIMEZONE

Store all timestamps in UTC.

Display:

```text
UTC
```

and optionally allow the user to view local time.

Never ambiguously display dates.

---

# 74. DATE FORMATTING

Use:

```text
28 SEP 2026
17:30 UTC
```

for editorial UI.

Use ISO timestamps in API responses.

---

# 75. SEO CONTENT

Create useful indexable pages around factual search intent:

```text
free AI APIs
free AI APIs without credit card
free Claude API
free GPT API
free Qwen API
free Llama API
free AI inference
shared AI token pools
free OpenAI compatible APIs
free Anthropic compatible APIs
```

But do not create SEO pages claiming an offer is free if the database says otherwise.

---

# 76. NO MANUAL REDEPLOY REQUIREMENT

This is mandatory.

Changing:

```text
pool remaining
model list
provider status
quota
new offer
ended offer
last verified time
```

must NOT require:

```text
git commit
git push
Vercel deployment
frontend build
```

The frontend reads the database dynamically.

A deployment is only required for code changes.

---

# 77. MONITORING SCHEDULE

Default:

```text
Every 5 hours
```

The scheduler should be configurable.

Recommended:

```text
*/5-hour logical schedule
```

Do not assume cron syntax can directly represent every five hours from midnight without considering drift.

Use a deterministic scheduler strategy.

Store:

```text
last_run_at
next_run_at
```

---

# 78. IDEMPOTENCY

A monitoring job must be safe to retry.

If the same source is fetched twice:

Do not create duplicate changes.

Use:

```text
source
timestamp/window
response hash
normalized payload hash
```

to detect duplicates.

---

# 79. OBSERVABILITY

Monitor:

```text
job duration
source failures
HTTP failures
parse failures
database failures
new offers
changed offers
ended offers
```

Create a monitoring log.

---

# 80. ADMIN SECURITY

Admin routes MUST NOT be public.

Use secure authentication.

Do not rely on:

```text
hidden URL
query parameter
hard-coded password in frontend
```

---

# 81. MVP PHASES

## Phase 1 — Foundation

Build:

* Next.js application
* database schema
* homepage
* provider registry
* model registry
* offer registry
* status system
* dark/light theme
* responsive layout

## Phase 2 — Monitoring

Build:

* source collectors
* scheduled worker
* observation storage
* change detector
* source health
* freshness

## Phase 3 — Intelligence

Build:

* NEW
* CHANGED
* ENDED
* timeline
* evidence
* verification

## Phase 4 — Discovery

Build:

* candidate queue
* AI extraction
* source verification
* admin review

## Phase 5 — Developer platform

Build:

* public API
* exports
* provider/model endpoints

## Phase 6 — SaaS

Build:

* accounts
* watchlists
* alerts
* Telegram
* Discord
* email
* subscriptions

---

# 82. MVP DEFINITION OF DONE

The MVP is complete only when:

### Website

* [ ] Cinematic responsive landing page
* [ ] Dark mode
* [ ] Light mode
* [ ] Radar hero
* [ ] Live statistics
* [ ] Upcoming events
* [ ] Live offers
* [ ] New offers
* [ ] Changed offers
* [ ] Ended offers
* [ ] Provider index
* [ ] Model index
* [ ] Timeline
* [ ] Methodology
* [ ] Evidence links

### Data

* [ ] PostgreSQL database
* [ ] Provider table
* [ ] Model table
* [ ] Offer table
* [ ] Event table
* [ ] Observation table
* [ ] Change table
* [ ] Historical retention

### Monitoring

* [ ] 5-hour scheduler
* [ ] Source health
* [ ] Automatic discovery/update
* [ ] Change detection
* [ ] Failure handling
* [ ] Freshness tracking
* [ ] No false "ended" status when a source fails

### Deployment

* [ ] GitHub repository
* [ ] Vercel deployment
* [ ] Public URL
* [ ] Worker deployment
* [ ] Database deployment
* [ ] Environment variables
* [ ] No secrets committed

### UX

* [ ] Mobile
* [ ] Desktop
* [ ] Keyboard accessible
* [ ] Loading states
* [ ] Error states
* [ ] Empty states
* [ ] Stale states

---

# 83. ACCEPTANCE TEST

The agent must demonstrate the following.

### Test 1

Change a database record.

Expected:

The website reflects the change without redeploying.

### Test 2

Add a new offer.

Expected:

It appears in NEW.

### Test 3

Change a quota.

Expected:

A CHANGE event appears.

### Test 4

Mark an offer ended.

Expected:

It disappears from LIVE and appears in ENDED.

Historical record remains.

### Test 5

Make a source fail.

Expected:

The offer does NOT become ENDED.

Source health becomes FAILED/STALE.

### Test 6

Run monitoring twice with identical source data.

Expected:

No duplicate change events.

### Test 7

Open on mobile.

Expected:

No horizontal page overflow.

### Test 8

Disable animation preference.

Expected:

Motion is reduced.

### Test 9

Open a provider page.

Expected:

Official source, current offers, models, verification time, and historical changes are visible.

### Test 10

Deploy.

Expected:

Public URL works on a separate device without local environment dependencies.

---

# 84. PRODUCT QUALITY BAR

The finished product should feel like an established technical intelligence platform, not an AI-generated landing page.

Prioritize:

1. Data correctness
2. Evidence
3. Freshness
4. Historical accuracy
5. UX clarity
6. Visual quality
7. Performance
8. Automation
9. Extensibility

Do not sacrifice data integrity for visual polish.

---

# 85. IMPORTANT IMPLEMENTATION PRINCIPLE

The frontend should be a **viewer of intelligence**, not the intelligence engine.

Separate:

```text
COLLECTION
    ↓
VERIFICATION
    ↓
NORMALIZATION
    ↓
HISTORY
    ↓
DATABASE
    ↓
API
    ↓
FRONTEND
```

This allows the same dataset to eventually power:

* website
* mobile app
* Discord bot
* Telegram bot
* browser extension
* RSS feed
* public API
* email alerts
* MCP server
* CLI
* AI agent

---

# 86. FUTURE MCP SERVER

Design the public API so a future MCP server can expose:

```text
search_free_models
search_free_providers
get_live_pools
get_upcoming_pools
get_provider
get_model
get_recent_changes
get_ended_offers
```

Example agent request:

> "Find me currently free OpenAI-compatible models with no credit card and at least 1M context."

The MCP layer can query the same verified dataset.

---

# 87. FINAL PRODUCT VISION

Free Pool Radar should become:

> **The live market intelligence layer for $0 AI inference.**

Not merely:

> "Here are some free APIs."

But:

```text
DISCOVER
     ↓
VERIFY
     ↓
TRACK
     ↓
COMPARE
     ↓
ALERT
     ↓
HISTORY
     ↓
API
     ↓
AI AGENTS
```

The system should continuously answer:

> **What free AI access exists right now, what changed, what is coming next, and what disappeared?**

That is the core product.

---

# 88. AGENT EXECUTION INSTRUCTION

When an AI coding agent receives this document:

1. Treat this document as the product source of truth.
2. Inspect the existing repository before changing anything.
3. Preserve useful existing functionality.
4. Do not rebuild working infrastructure unnecessarily.
5. Build the database architecture before hard-coding UI data.
6. Build the frontend against database/API data.
7. Implement monitoring independently from frontend deployment.
8. Implement historical observations before implementing the visual timeline.
9. Never fabricate production data.
10. Use official sources wherever possible.
11. Clearly mark uncertain data.
12. Never expose secrets.
13. Never require a redeployment for data changes.
14. Test locally.
15. Run automated browser verification.
16. Fix responsive issues.
17. Build production.
18. Deploy to Vercel.
19. Verify the public URL.
20. Return the deployment URL and a concise implementation summary.

---

# 89. DEFINITION OF SUCCESS

A user should be able to open the site on any device and understand within **10 seconds**:

```text
What is free?
What is new?
What is live?
What is starting soon?
What changed?
What ended?
When was it last verified?
Where is the official source?
```

And a developer should be able to answer within **30 seconds**:

> "Can I use this model for $0 right now, through which provider, with what limits, and under what conditions?"

If the product achieves those two goals, the core product is working.
