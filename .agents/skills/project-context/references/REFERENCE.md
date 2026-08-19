# Reference: Zendesk Agent Workspace UI Structure

Source of truth for the `zendesk-crm-simulation` skill. All facts below are
drawn from Zendesk's own developer/help documentation, not from screenshots
we don't have rights to reproduce — so the simulation is an **original,
structurally-informed recreation**, not a copy.

## 1. Overall interface anatomy
Zendesk's Support agent interface has three persistent regions:
- **The sidebar** — a narrow rail down the left edge with navigation icons
  to major feature areas (Home, Views/tickets, etc.).
- **The top toolbar** — tabs for open/in-progress tickets, plus quick links
  to search and other apps.
- **The main window** — where ticket content is displayed.
Source: support.zendesk.com, "Introduction to the Support agent interface."

## 2. The context panel (the part that matters most for us)
In the modern **Agent Workspace**, the ticket sidebar became a "context
panel" on the right side of the screen. Agents toggle it between:
- **Customer context** — requester interaction history and details.
- **Apps** — third-party and custom apps.
- Also available: Knowledge (help center search), Side conversations,
  and (if enabled) custom object previews.
Agents can resize the context panel by dragging its shared border with the
ticket comments — apps built with `flexible: true` in their manifest
resize responsively with it.
Source: support.zendesk.com, "About the Zendesk Agent Workspace";
"Using the context panel."

## 3. How a sidebar app is actually rendered (this is the key mechanic)
Third-party apps in the ticket sidebar are **not free-form** — Zendesk
wraps every sidebar app in a **prebuilt container** the developer cannot
restyle:
- App icon (from the app's manifest/assets)
- App name (from the manifest)
- An expand/collapse toggle
- A content area — which is the actual `<iframe>` pointed at the app's
  hosted page (commonly `assets/iframe.html` in the Zendesk Apps
  Framework/ZAF tooling)
This container-plus-iframe pattern is exactly what we replicate visually:
a bordered card with an icon+name header and a chevron, wrapping
ChaiToke's own branded content.
Source: developer.zendesk.com, "Sidebar apps (Support)" design guidelines;
"Zendesk app quick start."

## 4. Real-world precedent for what ChaiToke would be
Zendesk's own marketplace already has this exact category of app: sidebar
apps that pull external data into the workspace without the agent leaving
the ticket — e.g. a CRM app that "pulls in key CRM data like contact
details and account status directly into the workspace," or apps that
show related records from other systems. ChaiToke's auto-fill panel is
structurally identical to this pattern, just with an LLM as the data
source instead of a lookup API.
Source: eesel.ai (Zendesk sidebar app guide, referencing standard
Zendesk Marketplace app categories); developer.zendesk.com sidebar app
design docs.

## 5. CTI / call handling (our "Thailand CTI" anchor)
When voice/Talk is active, agents can open a **call console** at the top
of the page to manage live calls without leaving the ticket workspace —
this is the UI element we simulate at the very top of the screen for the
inbound Thai customer call.
Source: support.zendesk.com, "About the Zendesk Agent Workspace."

## 6. What we deliberately did NOT copy
- No Zendesk logo, wordmark, or trademarked assets.
- No verbatim UI copy/microcopy from Zendesk's product.
- No claim of Zendesk affiliation, partnership, or certification anywhere
  in the demo — this is clearly a **simulation for pitch purposes**, and
  should be described that way verbally when presenting to judges.

## Primary sources consulted
- support.zendesk.com — "About the Zendesk Agent Workspace"
- support.zendesk.com — "Introduction to the Support agent interface"
- support.zendesk.com — "Using the context panel"
- support.zendesk.com — "Creating custom layouts to improve agent workflow"
- developer.zendesk.com — "Sidebar apps (Support)" (app design guidelines)
- developer.zendesk.com — "Zendesk app quick start"
- developer.zendesk.com — "Ticket and New Ticket sidebar" (Apps API ref)
- eesel.ai — "How to build a Zendesk ticket sidebar app: a complete guide"
- eesel.ai — "Your guide to the best Zendesk sidebar app in 2026"
