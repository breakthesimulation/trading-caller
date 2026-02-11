---
name: fullstack-builder
description: "Universal Full-Stack Web App Builder with advanced auto-execution mode. Use when building a complete, production-ready full-stack web application from scratch, scaffolding a new project end-to-end, or when the user asks to 'build me an app', 'create a web app', 'build a full-stack application', or similar requests for complete application development. Covers requirements analysis, tech stack selection, phased implementation, E2E testing with Playwright, CI/CD, and deployment."
---

# Universal Full-Stack Web App Builder (Advanced Auto-Execution Mode)

Build complete, production-ready full-stack web applications from scratch. The application to build is described in the user's query (app name, purpose, key features, user flows, technical preferences, data models, UI/UX details, etc.).

## Process

Follow this exact process without deviation:

### 1. Analyze Requirements

Thoroughly extract and expand all explicit/implied features:
- Core CRUD operations
- Authentication and authorization
- Real-time features
- Offline support
- Analytics and admin panels
- Payments integration

Add production essentials:
- Responsive design
- Accessibility (ARIA, WCAG)
- Security (input validation, CSP, rate limiting)
- Error handling, logging, monitoring hooks

### 2. Choose Tech Stack

Select and justify a modern, scalable stack tailored to the app. Example combinations:
- **Frontend**: Next.js/React + TypeScript + Tailwind
- **Backend**: NestJS/Node or FastAPI/Python
- **Database**: PostgreSQL/Supabase/MongoDB
- **ORM**: Prisma/TypeORM
- **Auth**: JWT/OAuth
- **Real-time**: Socket.io or Supabase Realtime
- **E2E Testing**: Playwright (preferred) or Cypress
- **Deploy**: Vercel/Render

### 3. Create Detailed Phase Plan

Define 14-18 sequential phases specific to the app. Each phase must include:
- Clear sub-steps and deliverables
- Key files to create/modify
- Git commit message
- Comprehensive E2E testing goals using browser automation (Playwright preferred)
- Performance/security checkpoints

#### Standard Phase Template

Adapt these phases to the specific app:

| Phase | Description |
|-------|-------------|
| 1 | Monorepo/Project Setup + Git + CI Basics |
| 2 | Database Schema + ORM Setup |
| 3 | Authentication & Authorization System |
| 4 | Core Backend API Endpoints |
| 5 | Frontend Scaffold + Routing + State Management |
| 6 | Core UI Components + Responsive Layout |
| 7 | API Integration + Real-Time Features |
| 8 | Advanced Features (offline, search, file uploads) |
| 9 | Analytics/Dashboard + Charts |
| 10 | Admin/Settings Panels + Theming |
| 11 | Playwright E2E Test Suite Setup |
| 12 | Full Browser-Based End-to-End Testing (multiple user flows) |
| 13 | Security Audit + Performance Optimization (Lighthouse 95+) |
| 14 | CI/CD Pipeline + Automated Tests |
| 15 | Documentation + README + Env Config |
| 16 | Deployment to Production Hosts |
| 17 | Post-Deployment Verification (browser checks on live URL) |

### 4. Execute Phases

Begin Phase 1 and work through every phase in strict order. For each phase:

- Provide full code for all new/changed files (TypeScript where applicable)
- Implement production quality: types, validation (Zod/Yup), loading/spinner states, error boundaries, accessibility, tests
- Set up and expand Playwright for realistic browser-based E2E testing
- End each phase with:
  - `git add . && git commit -m "detailed message"`
  - Detailed E2E test results: write/run browser tests covering user flows (login -> create -> edit -> delete -> edge cases)
  - Lighthouse/performance scores where relevant

For browser testing phases: Write comprehensive Playwright scripts that simulate real user behavior in headless/headful mode, covering happy paths, errors, mobile viewport, accessibility checks.

## Mandatory Rules

1. **PWA + offline-first** when suitable; otherwise optimized SPA + secure API
2. **Best practices**: clean architecture, DRY, env vars, linting (ESLint/Prettier), husky hooks
3. **Only include features that fit the app** - justify additions
4. **Full E2E coverage**: Every major phase must end with browser-automated tests verifying new functionality in an integrated environment
5. **Simulate realistic testing**: Describe browser navigation, clicks, form fills, assertions on text/network/storage
6. **Work silently** until 100% complete - do not pause for questions during execution

## Final Deliverables

When all phases are complete, provide:

1. Complete repository structure with all code
2. Full README (setup, run dev/prod, deploy commands)
3. CI/CD config
4. Live demo URL (Vercel/Render/Netlify)
5. Final Lighthouse/accessibility/security scores
6. Playwright test run summary (100% pass)
