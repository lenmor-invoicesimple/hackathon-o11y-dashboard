# Demo Script — o11y Dashboard (5 min)

Hi everyone, i'm here to demo the o11y dashboard i created for one of our services in InvoiceSimple.

---

## 0:00 — The Problem (30s)

Open Datadog, Mezmo, and Sentry side-by-side in three tabs.

**Say:**
> "So when something breaks in production, I have to jump between three tabs: Datadog to find the trace, Mezmo to find the logs, Sentry to find the error. The problem is that we use Datadog for tracing, but not for log ingestion — that's a higher-tier add-on and we already have Mezmo. Also, these 3 platforms don't talk to each other — in  Mezmo you have to manually set the time range in Mezmo's UI each time, and filter the logs. And Sentry has no concept of a trace ID, so you're searching by endpoint and eyeballing timestamps to find the related issue. 

So it's a lot of going back and forth, and that's not fun esp if you got paged at 2am.

So the dashboard I created aggregates these 3 services automatically."

<Switch to the dashboard.>

---

## 0:30 — Orient the Audience (30s)

Load `http://localhost:3007` with `is-unifiedxp-production` + last **1 hour** selected.

**Say:**
> "This is a live feed of Datadog traces from our checkout service. 
Each row is a trace (or a full request).
When you select a trace, you can see the spans inside that trace (which are the individual downstream requests). 
Here we can see the logs from Mezmo for that timeframe, and also the Sentry issues for that URL path and that timeframe.

Behind the scenes, 
It takes the start time and duration from Datadog and fires a time-windowed query to Mezmo — scoped to exactly that window. 
For Sentry it uses the span's URL path to scope the search, and looks for issues seen within a few minutes of the span. 
One click, three sources, all correlated.

Point out:
- The **status + code columns** (`ok · 200`)
- The **secondary badges** (`+429`, `·error`) — *"those are child span failures; the root request still returned 200"*
- The **span count** and **duration** columns

---

## 1:00 — Category Filter (30s)

Click through the **Resource Category Bar** — Checkout, Auth, Next.js, Sentry, Other.

**Say:**
> "Categories are derived from the root span's resource. I can isolate just checkout traffic with one click."

Filter to **Checkout** only.

---

## 1:30 — Drill Into a Healthy Trace (1m)

Click any `ok · 200` checkout row.

Walk through the detail panel:

1. **Waterfall** — *"parent-child spans, proportional timing — I can see which call took the longest"*
2. **Mezmo logs panel** — *"automatically scoped to 30 seconds around this span — no manual hunting in Mezmo required."* Show the level pills, then type a word in the search box to demo inline highlight.
3. **Sentry panel** — *"fuzzy-matched by path prefix within ±5 minutes. I can widen the window if nothing shows up."*

---

## 2:30 — Demo: Silent Background Failure (1m)

Open a browser tab and navigate to:

```
/checkout/[documentId]?simulate_error=demo
```

**Say:**
> "This simulates a real class of bug — a background job fails silently. The user sees a normal checkout page. The root span returns 200. But something broke."

Wait ~10s, hit **Refresh** on the dashboard. Find the new trace — it shows **`ok · 200 +500`**.

Click it and show:
- The `+500` secondary badge on the child span in the waterfall
- Mezmo log: `[Hackathon Demo Error] Background job failed`
- Sentry issue captured

**Say:**
> "Without this dashboard, you'd see a 200 in your logs and think everything was fine. The 500 is buried in a child span — invisible unless you know to go looking."

---

## 3:30 — Demo: Fatal Failure (45s)

Navigate to:

```
/checkout/[documentId]?simulate_error=fatal
```

The checkout page renders an error UI.

Back on the dashboard, refresh and find the new trace — it shows **`error · 500`**.

**Say:**
> "Now the root itself failed. Same signals — Mezmo log and Sentry issue — but the trace row tells a different story immediately. `ok +500` versus `error 500`: you know at a glance whether the user was actually impacted."

---

## 4:15 — The Payoff (45s)

Click **"Open full trace in Datadog ↗"** to show it bridges back to DD.

**Say:**
> "Every span links back to Datadog for the full picture. But for the first pass — finding what broke, where the logs are, whether Sentry caught it — I never have to leave this view."

Close with known limitations and what's next:

- *"Multi-service support would make this useful beyond just this one service"*
- *"Currently only shows is-unifiedxp spans — cross-service fetch is next, so the waterfall includes downstream calls to is-api and is-parse-server"*
- *"Sentry correlation is fuzzy today — matched by path prefix, not trace ID"*

---

## Pre-Demo Checklist

- [ ] Dashboard pre-loaded at `http://localhost:3007` (so it's not fetching live during the intro)
- [ ] A real `documentId` from staging verified to load cleanly
- [ ] If the trace list is sparse, switch to **3h or 6h** before presenting so the list isn't empty
- [ ] Three tabs open (Datadog, Mezmo, Sentry) ready for the opening comparison
