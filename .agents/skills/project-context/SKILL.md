---
name: zendesk-crm-simulation
description: >
  Build and maintain a high-fidelity, click-through frontend simulation of a
  Zendesk-style agent workspace with an embedded "ChaiToke" sidebar app,
  for use in a live hackathon pitch demo. Trigger this skill whenever the
  user asks to build, restyle, or extend the CRM simulation, the "iframe demo,"
  the "agent console," or anything referencing Zendesk/ZenDesk look-alike UI
  for ChaiToke.
---

# Skill: Zendesk-style CRM Frontend Simulation (ChaiToke)

## What this skill is for
This skill scaffolds and maintains a **frontend-only** simulation of a
Zendesk-style support agent workspace, with ChaiToke embedded the way it
would realistically ship in production: as a **sidebar app rendered in an
iframe**, inside the CRM's native "Apps" panel.

This is a pitch artifact. It exists to make judges believe — correctly —
that ChaiToke's real integration path is a small, well-understood
engineering lift (a standard CRM sidebar app), not a moonshot. It is NOT
the moment to prove the AI works; that's a separate concern (see
"Explicit non-goals" below).

## Product context (read before making UI decisions)
ChaiToke is an AI-driven Customer Support After-Call Work assistant for
Thai B2B enterprises. It combines Thai Speech-to-Text with a Thai LLM to:
transcribe call recordings, synthesize key information, and auto-fill CRM
support tickets (customer contact info, complaint summary, issue category,
priority) — cutting manual wrap-up time from 30s–3min down to a few
seconds. It's designed to integrate with standard VoIP/CTI systems and
CRMs via API. Target buyer: Thai enterprises with high inbound call volume
(telco, retail, utilities) — see Target Market context in project deck.

**For this task specifically:** Speech-to-Text is explicitly out of scope.
We are simulating the moment AFTER a call ends and ChaiToke has already
(hypothetically) processed it — the CRM auto-fill moment, inside a
Thailand CTI + CRM shell.

## Reference research: how Zendesk's real interface works
(Sourced from Zendesk's own developer and help documentation — see full
citations in `REFERENCE.md` in this repo root. Use that file as the visual
source of truth; don't invent Zendesk UI conventions not documented there.)

Key facts that drive our layout decisions:
1. Zendesk Agent Workspace has: a thin icon rail (far left), a top toolbar
   with ticket tabs, a main ticket conversation window, and a **context
   panel** on the right that toggles between "Customer" (requester details)
   and "Apps."
2. Third-party apps (like ChaiToke would be) run inside the **ticket
   sidebar location**, wrapped in a **prebuilt container** agents can't
   customize: app icon + app name header, an expand/collapse toggle, and a
   content area that is literally an iframe pointed at the app's hosted
   `iframe.html`. Our simulation should visually replicate this container
   chrome (header bar with icon/name/chevron) around the ChaiToke content,
   to sell the "this is a real plug-in app" impression.
3. When Zendesk Talk (CTI) is active, agents get a **call console** bar for
   managing live calls — this is our anchor for simulating the Thailand CTI
   call in progress at the top of the screen.
4. Apps in the sidebar are commonly used for exactly ChaiToke's category:
   pulling in external data (CRM/order lookups) directly into the
   workspace without the agent leaving the ticket.

## Explicit non-goals (do not build these)
- No real STT, no real LLM API call, no real Zendesk account/ZAF SDK
  connection. All "AI" behavior is simulated client-side with
  `setTimeout` and a hardcoded sample payload.
- No backend server, no database, no persistence between page loads.
- No auth, no multi-ticket routing, no real ticket list beyond 1–2 static
  mock rows for visual context.
- Do not connect this to `app.py` / `/api/parse-transcript` from the main
  MVP — that's a separate, already-built pillar. Keep this simulation
  fully static (plain HTML/CSS/JS, single file preferred) so it never
  depends on network calls during a live pitch.

## Component spec
Build a single static page at `static/crm-simulation.html`:

1. **Call console bar** (top, full width) — simulates an inbound Thailand
   CTI call: caller number, live call timer (counts up via `setInterval`),
   "🔴 Live Call" status pill, Mute/Hold buttons (visual only), and an
   "End Call" button that is the primary demo trigger.
2. **Icon rail** (far left, narrow, dark) — Home / Tickets (active) /
   Search / Apps icons. Static, decorative — sells "this is inside a real
   product," nothing needs to be clickable.
3. **Ticket tabs bar** — one active tab, e.g. "#4471 · Somchai J."
4. **Main ticket pane** (center) — subject line, requester name/avatar,
   status dropdown (visual only, defaults to "Open"), a conversation log
   area that prints a system message when the call starts and another
   when it ends, and a disabled-looking reply composer at the bottom
   (grayed out — this is intentionally NOT the interactive part of the
   demo, the sidebar app is).
5. **Context panel** (right) — tabs for "Customer" and "Apps" (Apps active
   by default). This is where the whole pitch payoff lives:
   - **Apps tab → ChaiToke app card**: styled with the Zendesk sidebar-app
     container chrome (icon + name + collapse chevron) wrapping ChaiToke's
     own orange-branded content, so it visually reads as "third-party app
     embedded via iframe," not "native CRM feature." Two states:
     - *Before "End Call"*: muted placeholder — "⏳ Waiting for call to
       end — ChaiToke will auto-generate this ticket the moment the call
       disconnects."
     - *After "End Call"*: ~1.2s loading state ("Analyzing call with Thai
       LLM…") → reveals populated fields (Customer Name, Phone, Category,
       Sentiment, Urgency badge, Summary, Action Items) from a hardcoded
       Thai sample payload, plus a **"Push to Ticket Fields"** button.
   - **"Push to Ticket Fields"** click: animates the extracted values into
     the Customer tab fields and the ticket's Tags/Priority badges in the
     main pane — this is the "wow" moment. Keep the animation snappy
     (under ~600ms), it needs to read well live on a projector.
   - A second, greyed-out/collapsed app card below (e.g. "Knowledge") for
     realism — proves ChaiToke sits *among* other apps, not alone.
   - A small trust-signal footer inside the ChaiToke card: something like
     "🔒 Connected via ChaiToke API · Scopes: Tickets (read/write)" — fake,
     but establishes the expectation that a real API contract exists.

## Visual language
- CRM chrome (rail, tabs, context panel structure): neutral Zendesk-like
  palette — white/light-gray panels, dark icon rail, blue accents for
  native active states. Keep this understated.
- ChaiToke's own app card: use ChaiToke's brand orange
  (`#FF6B00` / `#CC5500` gradient) so it visually pops against the neutral
  CRM chrome — judges should be able to tell at a glance "that's OUR
  product, living inside someone else's CRM." That contrast IS the pitch.
- No external logo assets (don't embed or copy an actual Zendesk logo/
  wordmark) — the goal is a structurally faithful, originally-drawn
  simulation, not a trademark reproduction.

## Acceptance criteria
- [ ] Opens standalone via `file://` or any static server — zero backend
      dependency.
- [ ] Full demo flow (page load → End Call → loading → auto-filled →
      Push to Ticket Fields → values land in Customer tab/badges) works
      with mouse only, no console/devtools needed, in under 5 seconds.
- [ ] Survives a re-run without a page refresh (i.e., don't hard-break
      state if "End Call" is clicked twice — disable it after first use).
- [ ] Renders correctly at typical projector resolution (1920×1080) and
      a laptop screen (1440×900) without horizontal scroll.
