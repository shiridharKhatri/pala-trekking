# Pala Trekking: Scroll Craft brief

**Self-authored under explicit creative delegation.** The client brief (see the
implementation prompt) set the direction: premium Himalayan expedition brand,
National Geographic editorial photography, documentary storytelling, minimalist
editorial type; no purple/blue gradients, no decorative blur, restrained motion.

## The eight topics
1. **Vibe:** documentary, high-altitude daylight, quiet confidence, exact. References: expedition field notebooks, survey altimeters, natural-history photo essays.
2. **Journey:** the view from the trail → the two gateway cities → what treks exist → who is going when → what else is nearby → what you can verify before booking → choose your trail.
3. **Energy:** loud open (hero), calm orientation, brisk lateral choice, quiet data, warm curiosity, steady reassurance, held close.
4. **Feeling curve and peak:** below.
5. **The thing no other site does:** the page reads the altitude of what you are looking at, from real data, and a trek page *draws its own ascent* as you read the days.
6. **Range:** premium-minimal leaning editorial; working surfaces (catalogue, booking, admin) stay plain and fast.
7. **World:** distinct scenes on one photographic world, not a single continuous flight.
8. **Assets:** none supplied. Licensed Wikimedia Commons photography (credits page); no generated imagery of real places.

## Feeling curve (homepage)
| Act | Feeling | Caused by |
|---|---|---|
| 1 Hero (pin, 2.4vh) | **Awe** (peak) | Ama Dablam recedes while the memorial cairns rise in front of the headline |
| 2 Gateways (flow + reveal) | Orientation | Kathmandu / Pokhara split with real elevations |
| 3 Featured (pan) | Choice | Treks travel sideways, labelled with facts not pitch |
| 4 Departures (flow, paper ground) | Immediacy | Live anonymous board |
| 5 Experiences (reveal, iris once) | Curiosity | Off-route places, optional |
| 6 Trust (flow) | Reassurance | Only platform facts, no invented numbers |
| 7 Close (flow, holds) | Commitment | One action, image holds |

**Peak sentence:** "The mountain stays put and the stones walk in front of the words."
**Tell-someone:** "It's the site where the page knows how high you are."

## Signature move
**The altimeter and the self-drawing ascent.** A fixed gauge (desktop) reads the
elevation of whatever is on screen from database fields (`data-alt`). On trek
pages the itinerary's stored elevations become a sticky profile that draws in
the accent colour as you scroll the days, stamping each overnight stop and
reading out its live weather. Coded in `components/Altimeter.tsx` and
`components/Ascent.tsx`; the vendored engine is untouched.

## Grammar
New grammar, **"altitude ledger"**: the page is an ascent; chrome is an
instrument (altimeter), not a menu of acts; data drives the visual layer.
Filmic one-shot lost (it hides sequence, but treks *are* sequences of days);
chaptered editorial forbids the full-bleed hero the brief required; live
surface, continuous world, typographic poster, gallery, split stage and cutlist
each conflicted with either the photographic world or a booking platform's need
for scannable structure.
