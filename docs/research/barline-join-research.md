# Barline join — the research record (three agent reports, 2026-08-28)

> ⭐ **Kept because it cost ~570k tokens across three agents and the scratchpad dies with the
> session.** The PLAN is `docs/plans/barline-join-plan.md`; this is the evidence under it. Revisions
> read: MuseScore `929d1e9` · LilyPond `beedbfa` · Verovio `efff0bc` (`~/dev/engine-sources`).
>
> ⛔ **Do not re-run this research.** Every UNKNOWN below is marked as one, with the route that
> failed — that list is the part that saves the next agent, not the findings.

---

# PART 1 — What the USER DOES, in five programs (survey)

# Joined / spanning barlines — what is the USER ACTION?

> A sourced survey, 2026-08-28. **Research only** — no design, no phases, no code.
> Every claim below carries its source. Where a source could not be reached the answer is **UNKNOWN**,
> never a plausible rule. Primary sources are the programs' own manuals and the specs; forum posts are
> marked **SECONDARY**; anything I worked out from a schema or from code is marked **inference**.
>
> ⭐ The engraving library (`reference/README.md`) was read FIRST, as the repo requires. Gould, Ross,
> Stone and Gerou & Lusk are all on disk and all four had something to say — §5.

---

## 1. The one-paragraph answer

**There is no single gesture, and the split runs straight down the middle: two programs make the join
a DIRECT MANIPULATION of the drawn barline and three make it a PROPERTY OF A GROUP.** In **Sibelius**
and **MuseScore 4** you click a barline's top or bottom end, a **square handle appears**, and you
**drag it vertically** onto the next staff — Sibelius calls it *"a purple square 'handle'"* and
MuseScore calls it *"the end handle"* and recommends the drag as *"the best [method] for extending
barlines through multiple staves"*. So the user's hunch — *"i'm not sure if Sibelius allows to drag
vertically the barline… but i think it does not place square to mark it"* — is **wrong on both
counts**: Sibelius both drags and shows a square. In **Dorico**, **Finale** and **LilyPond** the join
is not a barline property at all: Dorico derives it from the **bracket/ensemble type** and lets you
override it by selecting an item on two staves and clicking *Change barline joins*; Finale puts a
three-way **Draw Barlines** menu (*Only on Staves / Through Staves / Only Between Staves
(Mensurstriche)*) in the **Group Attributes** dialog of a staff **group**; LilyPond makes it the
presence or absence of one engraver in the enclosing context (`StaffGroup` has `Span_bar_engraver`,
`ChoirStaff` is *"identical to StaffGroup except that the contained staves are not connected
vertically"*). The **owning object** therefore differs by program — Sibelius: the barline's own
score-wide vertical extent; MuseScore: a per-barline boolean with a per-staff default seeded from the
instrument template; Dorico/Finale/LilyPond/MusicXML/MEI: the **staff group**. And **mid-score
variation** splits the same way: MuseScore (per barline), Dorico (a positional *bracket and barline
change* with a signpost) and Finale (a group with a measure range) can all do it; **Sibelius flatly
cannot** — *"This affects every system in the score simultaneously"* — and MusicXML cannot express it
either, because `<part-group>` lives only in the header. The one point every source agrees on is the
default: **piano joined, orchestral joined per family, and vocal staves NOT joined** — Sibelius:
*"Vocal staves are never joined to each other, nor to other instruments"*; Dorico: *"Vocal staves are
never joined by barlines, even when bracketed together"*; Gould gives the reason, twice: *"so that
barlines do not intersect the text."*

---

## 2. Comparison table

| | **Sibelius** | **Dorico** | **Finale** | **MuseScore 4** | **LilyPond** |
|---|---|---|---|---|---|
| **1. gesture** | click the **top/bottom end of a barline** → purple square handle → **drag vertically**. Delete removes a join. No menu, no dialog. | (a) set the layout's **ensemble type** / bracketing; barlines follow. (b) Engrave mode: select an item on the top staff + Ctrl-click one on the bottom staff → Formatting panel ▸ Bracketing ▸ **Change barline joins**. (c) at a meter change: Properties ▸ Time Signatures ▸ **Barline joins all staves** | Staff tool ▸ click/double-click a **group handle** ▸ *Staff ▸ Group and Bracket ▸ Edit* ▸ **Group Attributes** ▸ **Draw Barlines**: *Only on Staves / Through Staves / Only Between Staves (Mensurstriche)* | select a barline → **drag the end handle down** (or select the handle and press **↓**, or tick **Span to next staff** in Properties ▸ Barlines, then **Set as staff default**) | wrap the staves in a context: `StaffGroup` / `GrandStaff` / `PianoStaff` join; `ChoirStaff` and a bare `<< >>` do not. It is `\consists Span_bar_engraver` |
| **2. what OWNS it** | ⚠️ **the barline's own score-wide vertical extent** — explicitly *not* the bracket, *not* an Engraving Rules option, *not* per-bar | **layered, and the barline is always a consequence**: ensemble type → bracket → barline; exceptions on Engraving Options ▸ Barlines; Mensurstrich on Notation Options (per flow); local deviation = a **bracket and barline change** object | **the staff GROUP** — and a group is *not* a bracket (a group may have `Bracket: None`). Four layers: group *Draw Barlines* → *Use Alternate Group Barline* → Measure Attributes *Override Group Barlines* → per-staff *Break Barlines Between Staves* | **three owners**: the individual `BarLine` (`spanStaff`/`spanFrom`/`spanTo`), the **staff** as its default (`barLineSpan`), and the **instrument template** (`<barlineSpan>` in `instruments.xml`) which seeds the staff. ⭐ **Brackets are unrelated** — the handbook's Brackets page never mentions barlines | **the enclosing CONTEXT's engraver list.** `SpanBar` is a distinct grob from the `BarLine`s it spans; per-boundary escape is `BarLine.allow-span-bar` |
| **3. mid-score?** | ⛔ **NO.** *"This affects every system in the score simultaneously."* Workaround = fake barlines (plug-ins). Real mid-score route is per-staff **suppression** via a staff type + instrument change | ✅ **yes, first-class** — a positional *bracket and barline change* with a **signpost**, running *"until the next existing bracket and barline change or the end of the flow"*; undone by *Engrave ▸ Reset Bracketing*. ⚠️ granularity is the **system**, not the bar | ✅ **yes** — a group carries **Measures _ Through _**; *"You can group and ungroup by individual systems using multiple group definitions with differing measure regions."* ⚠️ granularity is again the **system** (*"so long as a measure is in this range, and begins a staff system"*) | ✅ **yes, and it is the natural granularity** — select the barlines you want and tick **Span to next staff**; *Set as staff default* is the opt-in to make it staff-wide | ✅ **yes** — `\once \override Staff.BarLine.allow-span-bar = ##f` at a moment; `\once \hide Score.SpanBar`; or `\set Timing.measureBarType` |
| **4. affordance / drag** | ⭐⭐ **YES — a purple square handle, vertical drag.** Not persistent: it appears only on a careful click at the barline's **end**. Special barlines excluded. Brackets use the identical idiom | ⛔ **no drag, no vertical handle.** Affordance = a **signpost** after the fact. The only barline handle is a *square note-spacing handle*, moved with **Alt+←/→**, horizontal, keyboard-only. *(SECONDARY, one forum post claims Alt+drag works in Engrave mode — uncorroborated by any manual page, treat as unreliable)* | ⛔ **no vertical barline drag.** Group/bracket handles **do** drag vertically, but only cosmetically — *"you can make it appear to enclose even non-grouped staves"*. The Measure tool's barline handle drags **horizontally** only (bar width) | ⭐⭐ **YES — "the end handle", and dragging is the handbook's FIRST recommendation.** Plus **↓/↑** on the handle, plus numeric *Span from* / *Span to* (units: **half spaces**), plus **Span presets** buttons | ⛔ none. It is a text compiler; every mechanism is an `\override` / `\set` / `\consists` in a `.ly` file |
| **5. defaults** | piano **joined**; orchestral **joined per section, broken between**; small ensemble **one unbroken line**; **vocal staves never joined**. ⛔ organ **UNKNOWN** | piano/grand-staff **joined, and only to itself** (braced instruments are excluded from brackets); orchestral **joined per family**; **vocal never joined, even when bracketed**; ⛔ organ **UNKNOWN** | general rule stated (*"Normally, when you group some staves together, the barlines are drawn continuously through them"*) + Setup Wizard auto-creates family groups. ⛔ the **per-ensemble specifics (piano/SATB/organ/sections) are NOT in the manual** | mechanism sourced (`instruments.xml` `<barlineSpan>` → per-staff boolean chain; absent ⇒ `false`). ⛔ the **actual values are UNKNOWN** — `instruments.xml` could not be fetched | `GrandStaff`/`PianoStaff` (brace) **joined**; `StaffGroup` (bracket) **joined**; `ChoirStaff` (bracket) **NOT joined**; bare `<< >>` **not joined** |

**Formats, same questions:**

| | **MusicXML 4.0** | **MEI v5** |
|---|---|---|
| owner | `<group-barline>` inside `<part-group>`, in `<part-list>` — **header only** | `@bar.thru` on `<staffGrp>` |
| values | `yes` / `no` / **`Mensurstrich`** (note the capital M) | `@bar.thru` boolean, **plus an orthogonal `@bar.method` = `staff` \| `mensur` \| `takt`**, which **wins** |
| mid-score | ⛔ **impossible** cross-part — `part-group` is not in the `music-data` content model | ✅ **yes** — a `<scoreDef>` inside a `<section>` is a **milestone** redefining the `<staffGrp>` |
| the join inside ONE multi-staff part (piano) | **implicit**: *"A part-group element is not needed for a single multi-staff part. By default, multi-staff parts include a brace symbol and (if appropriate given the bar-style) common barlines."* `<part-symbol>`'s `top-staff`/`bottom-staff` silently changes it | the grand staff is just a `<staffGrp>` — *"The staffGrp element is also used for the two staves of a grand staff."* |
| does `<barline>` itself carry a span? | ⛔ **no** — it is per-part, and none of its attributes or children names a staff | ⛔ no; the join is on the group |

---

## 3. Program by program

### 3.1 SIBELIUS — ⭐⭐ a purple square handle you drag vertically. **The user's guess is wrong on both counts.**

**Source:** *Sibelius Reference Guide*, version **2022.3**, Avid, Guide Part Number 9329-66370-00 REV A
3/22, `https://resources.avid.com/SupportFiles/Sibelius/2022.3/Sibelius_Reference.pdf` (accessed
2026-08-28). Page numbers are the guide's own printed numbers. **PRIMARY.**

**1. The gesture** — there is no menu, no dialog and no keystroke. §4.5 *Barlines*, sub-heading
**"Barline joins"**, printed **p. 343**, verbatim:

> *"Sibelius automatically joins staves into groups of similar instruments with barlines (see box).
> However, you may want to change this, as follows:
> • Preferably find a point in the score where there are no hidden staves, so you can check all
> barline joins at once
> • **Click carefully at the top or bottom of a normal barline** (you can't use special barlines to
> change barline joins) in the score; **a purple square "handle" will appear**
> • **Drag the handle up or down the system to extend or contract the barline. This affects every
> system in the score simultaneously.**
> • You'll find that by extending or contracting the barlines down the system you can reorganize the
> way staves are joined by barlines any way you like."*

Removing a join, same page:

> *"click the top or bottom of the barline so that the purple handle appears, then **press Delete**.
> To restore barlines to those staves, click the top or bottom of the barline on an adjacent staff,
> and drag it across the staves with no barlines."*

⭐ **Mensurstriche in Sibelius is NOT a join — it is a barline TYPE.** §4.5 *Early music barlines*,
printed **p. 341**: *"set the **Default barline type to Between Staves** on the Barlines page of
Appearance ▸ House Style ▸ Engraving Rules."* Note where that puts it: a global default, in the
house style, in a different chapter from joins.

**2. What owns it** — ⚠️ **none of the four candidate owners.** It is a **score-wide vertical extent
belonging to the barline itself**, i.e. a property of *staff adjacency*, and Sibelius says explicitly
that it is not the bracket:

> §4.19 *Brackets and Braces*, printed **p. 398** sidebar: *"Instruments bracketed, sub-bracketed or
> braced together **normally also** have their staves joined by barlines."*
> §4.5 sidebar: *"These groups **often, but by no means always**, reflect the way staves are grouped
> with brackets."*

Two separate draggable objects with two separate gestures — and the bracket uses the *identical*
idiom (§4.19: *"Click on the end of an existing bracket, sub-bracket or brace, so it turns purple.
Drag it up or down to extend or contract it."*). It is also **not** an Engraving Rules option: the
Engraving Rules ▸ Barlines page (printed p. 344) offers only default barline type, wings, thickness
and double-barline separation — no join control.

**3. Mid-score — ⛔ NO.** *"This affects every system in the score simultaneously"* (p. 343) is the
manual saying so. **SECONDARY confirmation**, Scoring Notes (Philip Rothman), 2017-01-31, *"Fake it
'til you make it: New Sibelius plug-in for per-staff barline"*: *"What's not possible, however, is to
mix it up: to have barline joins appear in some bars, but not in others."*
`https://www.scoringnotes.com/tips/fake-it-til-you-make-it-new-sibelius-plug-in-for-per-staff-barline/`
The documented workaround is faking it — an invisible barline plus a drawn line, automated by Bob
Zawalich's *Add Fake Barline to Bars* and Roman Molino Dunn's *Barline Tool* plug-ins.
⭐ The manual's only *real* mid-score route is per-staff **suppression**, not joining: define an
instrument whose staff type has **Barlines** switched off (Edit Staff Type ▸ General), then apply an
instrument change at the bar where it should start (pp. 343–344).

**4. Affordance — ⭐⭐ YES, a square, and dragging is the ONLY mechanism.** *"a purple square 'handle'
will appear"* … *"Drag the handle up or down the system"*. ⚠️ The nuance worth carrying: the square is
**not persistently displayed** — it appears only after a precise click on the barline's **top or
bottom END**, which is why the manual writes *"Click **carefully**"*. And special barlines are
excluded: *"you can't use special barlines to change barline joins"*. Separately, a staff *type* can
set a barline's own vertical reach in staff-line gaps — *"Extend above center of staff by n staff line
gaps"* / *"Extend below…"* (Edit Staff Type ▸ General, printed p. 188), negatives allowed.

**5. Defaults** — §4.5 sidebar box, printed **p. 343**, verbatim:

> *"For clarity, staves are normally joined by barlines to group similar instruments together. […] In
> orchestral scores, staves with the woodwind, brass, percussion and string sections are normally
> joined by barlines but separated from adjacent sections. **Vocal staves are never joined to each
> other, nor to other instruments.** Staves for the same keyboard instrument are joined together but
> separated from adjacent instruments. When a score uses just a few instruments (such as a wind
> quintet), an unbroken barline is used to avoid looking fussy."*

⇒ piano 2-staff **joined**; SATB choir **NOT joined**; orchestral **joined per section, broken between
sections**; small ensemble **one unbroken line top to bottom**. ⭐ Note this reproduces Gould §5.5 and
Ross case 5 exactly, including the vocal exception.

⛔ **UNKNOWN — organ.** The guide states the *brace* rule (*"an organ pedal staff is not braced to the
organ manuals"*, p. 398) but **never states the barline join for organ**. The keyboard sentence would
*imply* all three staves joined; that is an inference and is not sourced.

---

### 3.2 DORICO — the join follows the BRACKET, and a local override is a positional CHANGE object

**Source:** Dorico Pro **4** documentation at `archive.steinberg.help/dorico/v4/…` (accessed
2026-08-28). ⚠️ **Route note**, already recorded in `reference/README.md`: `steinberg.help` is a
JavaScript reader and returns only a nav shell; `archive.steinberg.help/dorico/v4` has full topic
bodies, v5's are stubs, and ≥6 is unreachable. ⚠️ **Fidelity caveat**: these pages were fetched
through an extractor, so the quoted strings are extractor output rather than a PDF's own text — solid,
but a notch below the Sibelius PDF and the MuseScore markdown.

**1. The gesture — three distinct routes, and they are three different features.**

**(a) The normal case is not a barline action at all.** *Barlines across staff groups*:

> *"**By default, barlines automatically extend across staff groups that are joined by a bracket or
> brace, except for vocal staves, across which barlines never automatically extend.**"* … *"Dorico Pro
> automatically brackets staves according to the ensemble type set for each layout."*

⇒ you set the ensemble type / bracketing (Engrave ▸ Engraving Options ▸ **Brackets and Braces**) and
the barlines follow.

**(b) A local override — *Inputting custom barline joins*, Engrave mode** (prerequisites: the left
zone shown, **Graphic Editing** selected in the Engrave toolbox):

> 1. *"In Engrave mode, select an item on the top staff you want to join with a barline, **at the start
>    of the system from which you want this change to apply**."*
> 2. *"**Ctrl/Cmd-click** an item on the bottom staff you want to join with a barline."*
> 3. *"In the **Formatting** panel, click **Change barline joins** in the **Bracketing** group."*
>
> *"All staves between and including the staves on which you selected items are joined by a barline
> **until the next existing bracket and barline change or the end of the flow**, whichever comes
> first. **A signpost appears** at the start of the system in which you selected items. If necessary,
> any existing barline joins are adjusted to accommodate the new barline join."*

The panel's own button texts: **Insert bracket** — *"Joins the staves on which you have selected items
with a bracket. **By default, this also causes barlines to be drawn across the bracketed group.**"*;
**Change barline joins** — *"Joins the barlines across the staves on which you have selected items."*

**(c) A one-off at a meter change** — *"Select the time signature changes where you want to join all
staves with a barline… In the Properties panel, activate **Barline joins all staves** in the **Time
Signatures** group."* ⚠️ Quoted from the **v1** page; the v4 path for this topic could not be located
(see UNKNOWNs). ⭐ Note what this means: the one place a *single* line carries the property, the
property is on the **time signature**, not on the barline.

**Mensurstrich is a Notation Option, per flow** — *"Barline joins only between staves are known as
'Mensurstriche'. They are commonly used when typesetting early music…"*, changed on the **Barlines**
page of **Write ▸ Notation Options** (*"whether single barlines between staves only appear between
staves or extend across staves"*).

**2. What owns it** — ⚠️ **not the barline**; ownership is layered and the barline is always a
consequence: the **layout's ensemble type** → bracketing → barlines; **player groups** in Setup mode
(*"You can create custom barline joins and bracket groups by manually arranging your players into
groups"*); **Engraving Options ▸ Barlines** owns the exceptions (*"whether barlines join vocal staves
and ossia staves"*); **Notation Options ▸ Barlines** (per flow) owns cross-staff vs Mensurstrich; and
a **bracket and barline change** — a positional object with a signpost — owns any local deviation.

**3. Mid-score — ✅ yes, first-class.** A bracket and barline change runs *"until the next existing
bracket and barline change or the end of the flow"*. To end a joined passage you **reset**: select an
item at the position, **Engrave ▸ Reset Bracketing** — *"Staff grouping, including both bracket/brace
grouping and barline join changes, is reset to the project-wide staff grouping sections from the
selected rhythmic position until the next existing bracket and barline change or the end of the
flow."* Finer control: *"You can reset bracketing and barlines **independently** using the Properties
panel's **Change bracketing** and **Change barlines** settings in the **Bracket and Barline Changes**
group, setting them to **Auto**."*
⚠️ **Granularity is the SYSTEM, not the bar** — *"You cannot move bracket and barline change signposts,
as they are intended to apply to system start positions… When a bracket and barline change signpost is
positioned partway through a system, the corresponding change only takes effect from the start of the
next system."*

**4. Affordance — ⛔ no drag, no vertical handle.** The join is made by *selecting items on two
staves* and clicking a panel button; the only visible affordance afterwards is the **signpost**. The
one barline handle Dorico has is horizontal and keyboard-only: a *"square note spacing handle at the
rhythmic position of each barline"*, moved with **Alt/Opt+←/→**; mouse dragging is not supported.
*(**SECONDARY, uncorroborated**: a Steinberg forum poster, 2024-08-28, claims *"You can also switch to
Engrave Mode and drag the bar lines up, whilst holding down the alt-key."* No manual page supports
this. Treat as unreliable.)*

**5. Defaults** — *Brackets according to ensemble type* + *Barlines across staff groups*:
- **Piano / grand-staff instruments — joined, and only to themselves**: *"Dorico Pro automatically
  joins barlines across grand staff instrument staves as they are braced. Because staves cannot be
  bracketed and braced simultaneously, grand staff instruments are excluded from brackets and
  therefore are not joined with barlines to any other staves."*
- **Orchestral — joined per family**: ensemble type *Orchestral* = *"Staves are bracketed according to
  their instrument family"*, barlines follow. In tiny projects *"barlines do not extend across the
  whole ensemble, because all the instruments are from different families."*
- **Choir / SATB — ⭐ NOT joined**: *"**Vocal staves are never joined by barlines, even when bracketed
  together.**"* Overridable on Engraving Options ▸ Barlines. *(SECONDARY: a forum poster names the
  group **"Barline joins"** and reports it greyed out for non-vocal player types — unconfirmed.)*
- ⛔ **Organ — UNKNOWN.** No source found for whether Dorico braces/joins two or three staves.

---

### 3.3 FINALE — a DIALOG on a staff GROUP, with a measure range. No vertical drag anywhere.

**Source:** MakeMusic user manuals. ⚠️ **Route note:** the current `FinaleMac/` and `FinaleWin/` trees
**403** to curl and WebFetch (re-confirmed 2026-08-28, as `reference/README.md` already records); the
**versioned trees over plain HTTP work** — quotes below are from `Finale2014Win` and `Finale2012Mac`.
**PRIMARY**, but see the version caveat in the UNKNOWN list.

**1. The gesture** — Staff tool ▸ group handle ▸ **Group Attributes** dialog ▸ **Draw Barlines**
drop-down. `Barlines.htm`, *"To draw the barline on a group"*, verbatim:

> *"Grouped staves have an important characteristic: instead of drawing barlines only on the staves,
> the barlines can either be drawn through or between staves in a group. Make sure you're in Scroll
> View before you begin (in case staves have been hidden). Choose the **Staff tool**… **Click a group
> handle** to select it. If you haven't yet created the group, do so now. Choose **Staff ▸ Group and
> Bracket ▸ Edit**. Or, **double-click a group handle**. The **Group Attributes** dialog box appears.
> Use the **Draw Barlines** drop-down menu to specify how you want barlines to appear for this group.
> Choose **Only on Staves** to draw the barline only within each staff, and not connect each staff
> with the barline. Choose **Through Staves** to draw a barline as one continuous line passing
> through all the staves in the group. Choose **Only Between Staves (Mensurstriche)** to draw a
> barline between staves, but not through the staff lines themselves."*
> — `http://usermanuals.finalemusic.com/Finale2014Win/Content/Finale/Barlines.htm`

⭐⭐ **Finale gets Mensurstrich for free as the third value of the same control** — it is a property of
the join, not a barline type as in Sibelius. That is a real modelling disagreement between the two
programs and it is worth more than it looks.

The per-staff escape hatch, **Staff Attributes** (`ISDLG.htm`), verbatim:

> *"**Break barlines between staves • Break repeat barlines between staves.** Normally, when you group
> some staves together, the barlines are drawn continuously through them (including the blank spaces
> between them). Select "Break Barlines Between Staves" if you want barlines—both normal and repeat
> barlines—not to continue through to the next staff **above** this one. (If this staff isn't part of
> a staff group, you won't notice any difference.) Select "Break Repeat Barlines Between Staves" if
> you want to break repeat barlines that would normally continue through to the next staff above this
> one. This option doesn't affect normal barlines."*

⭐ Note that Finale gives **repeat** barlines their own independent span switch — nobody else does.

**2. What owns it** — **the staff GROUP**, and ⚠️ **a group is NOT a bracket**: a group can carry a
barline setting with no bracket at all (*"Bracket Options. When you first enter this dialog box, None
is selected by default… click None if you don't want a bracket to enclose the group."*), and a staff
may belong to several (*"You can assign a staff to as many groups as you like"*, `Groups.htm`).
There are **four** layers, in order: the group's **Draw Barlines** → **Use Alternate Group Barline**
(a barline *style* for the group) → Measure Attributes' **Override Group Barlines** (*"the barline
set in the Measure Attributes dialog box will always appear, regardless of any alternate barline
style selected in the Group Attributes dialog box"*) → the per-staff **Break Barlines Between
Staves**. The instrument/ensemble definition only *seeds* groups: *"Finale automatically creates group
brackets for instrument families when you create new documents with the Setup Wizard, and also updates
groups when you add, remove, or change the instrumentation with the Score Manager… you can disable
automatic group updating [by] unchecking 'Automatic Instrument Family Group Brackets' in
Preferences-Edit."* (`Groups.htm`)

**3. Mid-score — ⭐⭐ YES, first-class, because a GROUP carries a MEASURE RANGE.** `GROUPDLG.htm`:

> *"**All Measures • Measures ___ Through ___.** Choose All Measures to assign this group to all
> systems in the score. Or, in these text boxes, enter the measure range for the group to assign it to
> specific systems. **So long as a measure is in this range, and begins a staff system**, the bracket
> will appear."*

`Groups.htm`: *"Noteman says: **You can group and ungroup by individual systems using multiple group
definitions with differing measure regions.** See To modify brackets on a system-by-system basis."*
The gesture (`Brackets_Staves.htm`): *"you simply need to delete the bracket on the system that
requires alterations, and then define a new one accordingly, assigning it to the measures of that
system. (When you do this, Finale automatically creates two new bracket definitions for the systems
included in the former bracket's definition—one for systems before the deleted bracket, and one
after)."* — Page View ▸ Staff tool ▸ select handle ▸ *Staff ▸ Groups and Brackets ▸ Remove*, then
*▸ Add*.

⚠️ **Granularity trap:** the range is entered in **measures**, but the rule is *"So long as a measure
is in this range, **and begins a staff system**"* — so the effective unit is the **system**, not an
arbitrary bar.

**4. Affordance — handles exist, but they drag the BRACKET, never the barline.** With the Staff tool,
*"Handles appear on every group bracket in the document"*, and they are vertically draggable — but
cosmetically only: *"Drag the bottom handle up or down. Drag the top handle left, right, up, or down…
When you drag either handle vertically, **you can make it appear to enclose even non-grouped
staves**."* (`Brackets_Staves.htm`) — i.e. the drag changes neither membership nor the join. Barline
handles do exist, under the **Measure tool**, and they drag **horizontally only**: *"A handle appears
on each barline. Drag the top handle of the desired barline **horizontally**… The measure becomes
wider or narrower."* (`Barlines.htm`) **There is no vertical barline drag in Finale.**

**5. Defaults** — the general rule is stated (`ISDLG.htm`): *"**Normally, when you group some staves
together, the barlines are drawn continuously through them** (including the blank spaces between
them)."* Combined with the Setup Wizard auto-creating instrument-family groups, the documented default
is: **auto family group ⇒ barlines through it**, joins breaking between families.
⛔ **UNKNOWN — the per-ensemble specifics.** Whether the Setup Wizard's SATB choir group ships as
*Through Staves* or *Only on Staves*, and likewise piano / organ / orchestral sections, is **not
stated anywhere in the Finale manual**; the *Choral music* page is four tips about Explode and Clone
Lyric and says nothing about barlines or brackets. It is settled by template files / Document Styles
that were not inspected.

---

### 3.4 MUSESCORE 4 — ⭐⭐ a drag handle, AND a Properties checkbox, AND a staff default. All three.

**Source:** the current MuseScore Studio handbook,
`https://handbook.musescore.org/notation/rhythm-meter-and-measures/barlines` (accessed 2026-08-28) —
served as markdown, so the quotes are literally verbatim — plus the MuseScore source read **first-hand
from the local checkout at `~/dev/engine-sources/MuseScore`** (`reference/README.md` §ENGINE SOURCES).

**1. The gesture.** Handbook, *"Changing barline length" ▸ "Extending all barlines in a staff"*:

> 1. *Select a barline on the 'starting' (topmost) staff.*
> 2. *Do any of the following:*
>    - *Drag the **end handle** downwards until it meets the destination staff (**this method is the
>      best for extending barlines through multiple staves**).*
>    - *Select the edit handle and press `Down`.*
>    - *Check the **Span to next staff** box in the **Barlines** section of the **Properties** panel,
>      then click **Set as staff default**.*
> 3. *Repeat if required for subsequent staves.*
>
> *The barline snaps into place, and all other barlines in that staff follow.*

And *"Extending selected barlines in a staff"*: *"1. Select one or more barlines (and their
counterparts in the staves below if there are more than two staffs to join). 2. Check **Span to next
staff** in the **Barlines** section of the **Properties** panel."*

⭐ **So dragging is alive and documented in MuseScore 4** — it did not go away with the Inspector. The
page even embeds a video (`barlines-extend.mp4`).

**Mensurstrich is built from these same controls, not a mode**: uncheck *Show barlines* in the bottom
staff's Staff/Part properties, then for each remaining staff check **Span to next staff** on the first
barline, adjust **Span from**, and click **Set as staff default**
(`handbook.musescore.org/alternative-notation/mensural-notation-and-mensurstrich`).

**2. What owns it — THREE owners in a hierarchy, and ⭐ brackets are NOT one of them.**

**(i) The individual barline.** Properties ▸ Barlines: *"**Span to next staff**: If checked, the
barline will be extended to reach the next staff down. **Span from**: The vertical position of the top
of the barline. **Span to**: The vertical position of the bottom of the barline."*
First-hand in `src/engraving/dom/barline.h:178–179`:
`bool m_spanStaff = false; // span barline to next staff if true` and `int m_spanFrom = 0; // line number on start and end staves` (+ `m_spanTo`).

**(ii) The staff, as the default for all its barlines.** *"The **Set as staff default** button will
apply all the **Span** settings of the currently selected barline to all barlines on the staff."*
First-hand in `src/engraving/dom/staff.h:131,134,273`:
`bool m_barLineSpan = false; // true - span barline to next staff` (+ `m_barLineFrom` / `m_barLineTo`).
Re-seeded onto every element at layout — `rendering/score/measurelayout.cpp:782, 791, 929, 939`:
`bl->setSpanStaff(staff->barLineSpan())`.

**(iii) The instrument template**, which seeds (ii) at score creation — `dom/staff.cpp:1154`:
`setBarLineSpan(t->barlineSpan[templateStaffIdx])`, read out of `instruments.xml` by
`dom/instrtemplate.cpp`:
```cpp
} else if (tag == "barlineSpan") {
    int idx = readStaffIdx(e);
    int span = e.readInt();
    for (int i = 0; i < span - 1; ++i) { barlineSpan[idx + i] = true; }
}
```
⭐ Note the shape: the instrument definition holds a **count of staves**, expanded into a **per-staff
boolean chain**. A 4-staff join is four flagged staves, not one barline of height 4.

⛔ **Format ▸ Style ▸ Barlines is NOT an owner** — that page is appearance only (repeat wings, initial
system barline, thicknesses, distances, double-barline-before-key/time). And **brackets are
independent**: the handbook's Brackets page describes brackets, braces, their own `Span` property and
`Format ▸ Style ▸ System`, and **never mentions barlines**. A MuseScore bracket does not carry the
join; a Dorico bracket does.

**3. Mid-score — ✅ yes, and it is the natural granularity here**, because the property lives on each
barline. Bars 1–8 joined and bar 9 onward not = select the barlines of bars 1–8 (in every staff of the
group but the last) and tick **Span to next staff**; leave the rest. *Set as staff default* is the
explicit opt-in to make it staff-wide. *(**SECONDARY**, GitHub: "Customized barline spans not always
overridden when extending staff barline span", `musescore.org/en/node/287614` — reports that *Set as
staff default* behaves inconsistently across several staves at once.)*

**4. Affordance — ⭐⭐ YES, and the source says exactly what it looks like.** The handbook calls it the
**"end handle" / "edit handle"** and recommends the drag first. First-hand from
`src/engraving/dom/barline.cpp`:
- `BarLine::gripsPositions` (`:531–544`) returns **exactly ONE grip** — the top one is commented out at
  `:541` — at the barline's **bottom** end. ⇒ **one square, at the bottom.**
- `BarLine::dragGrip` (`:597+`) moves `yoff2` continuously, clamped between *"min for bottom grip is 1
  line below top grip"* and *"max is the bottom of the system"*. `endEdit` then **snaps to the nearest
  staff** by a midpoint test.
- ⭐⭐ **A MODIFIER decides what the drag writes** (`:579` and `:675`):
  ```cpp
  bool local = ed.control() || segment()->isBarLineType() || spanStaff() != score()->staff(staffIdx())->barLineSpan();
  ```
  With **Ctrl** (or on a barline that already deviates) the change goes to that one `BarLine`
  (`Pid::BARLINE_SPAN`); **without Ctrl** it goes to the **STAFF** (`Pid::STAFF_BARLINE_SPAN`) and so
  applies for the whole score.
- **Keyboard equivalent** (`:567–571`): **↓ extends** the span when it is not spanning, **↑ retracts**
  it when it is — same `local` test, same two destinations.
- ⭐ **The span is a CHAIN of per-boundary booleans, not a range**: `endEdit` loops
  `for (staffIdx1 … staffIdx2) setSpanStaff(true)` and breaks the last. "Span" means *continue to the
  next staff down* — the same shape as Ross's *"and thereafter…"* framing (§5.3).

Beyond the drag, the handbook spells out the numeric affordances precisely:
> *"The **Span from** setting is an offset relative to the top line of the staff… positive values move
> down and negative values move up. The **Span to** setting works differently depending on whether
> **Span to next staff** is checked. If unchecked, this is an offset relative to the bottom line of
> the staff. If checked, the barline will be extended down to match the position of the top of a
> default barline on the staff below… **Exceptionally, in this situation, the offset works in
> reverse**: positive values move *up* and negative values move *down*. Finally, the unit for these
> offsets is in all cases the **half space**."*
> *"The **Span presets** buttons apply certain presets… When applied, the presets will set Span from
> and Span to to specific values and, except for Default, will disable Span to next stave."*

⛔ **UNKNOWN**: whether the barline's handle appears on plain selection or only in Edit mode. The
handbook's Barlines page implies selection suffices (*"Select a barline… Drag the end handle"*) but
the *Adjusting elements directly* page (`F2` / `Alt+Shift+E` / right-click ▸ Edit element) does not
mention barlines at all.

**5. Defaults** — the **mechanism** is sourced (above); the **values** are not.
⛔ `instruments.xml` (786 KB) could not be fetched from raw.githubusercontent, jsdelivr, or GitHub's
blob view, and the format documentation page returned **403**. So the actual `<barlineSpan>` values for
piano / organ / voice are **UNKNOWN**. What is certain from the source: absent a `<barlineSpan>`, the
staff default is `false` — separate barlines. Since SATB is four one-staff instruments, that *implies*
unjoined, but the template was not verified. *(**SECONDARY** corroboration that grand-staff barlines
are normally conjoined in MU4: GitHub issue **#15006**, *"[MU4 Issue] Grand staff barlines not
connected when inserted in score w/ multiple instruments"*, P1/engraving, opened 2022-12-07, whose
premise is *"Grand staff barlines should be conjoined in this case"* — i.e. it was a bug that they
were not, and only at initial score creation.)*

---

### 3.5 LILYPOND — the join is ONE ENGRAVER in the enclosing context

**Source:** the on-disk checkout `~/dev/engine-sources/lilypond` (HEAD `beedbfa0`, 3 Aug 2026,
*Copyright (C) 1997--2026*) cross-checked against the published v2.24 Notation Reference and Internals
Reference (accessed 2026-08-28). Line numbers are from the on-disk tree. **PRIMARY, first-hand.**

**1. The user action — which context you wrap the staves in.** `Documentation/en/notation/staff.itely`
§*Grouping staves*, and identically at
`lilypond.org/doc/v2.24/Documentation/notation/displaying-staves`:

> *"Various contexts exist to group single staves together in order to form multi-staff systems.
> **Each grouping context sets the style of the system start delimiter and the behavior of bar
> lines.**"* (`:149–151`)
> *"If no context is specified, the default properties will be used: the group is started with a
> vertical line, and **the bar lines are not connected**."* (`:153–155`)
> *"In the `StaffGroup` context, the group is started with a bracket and **bar lines are drawn through
> all the staves**."* (`:166–168`)
> *"In a `ChoirStaff`, the group starts with a bracket, but **bar lines are not connected**."*
> (`:179–180`)
> *"In a `GrandStaff`, the group begins with a brace, and **bar lines are connected between the
> staves**."* (`:191–192`)
> *"The `PianoStaff` is identical to a `GrandStaff`, except that its staves are only removed together,
> never separately."* (`:205–206`)

And `Documentation/en/notation/rhythms.itely:3797–3800`: *"In scores with many staves, a `\bar` command
in one staff is automatically applied to all staves. The resulting bar lines are connected between
different staves of a `StaffGroup`, `PianoStaff`, or `GrandStaff`."*

**2. What owns it — `Span_bar_engraver`'s presence in the context.** `ly/engraver-init.ly`:

| context | lines | declares |
|---|---|---|
| `StaffGroup` | 466–518 | `\consists Span_bar_engraver` (**:474**), `\consists Span_bar_stub_engraver` (:478), `systemStartDelimiter = #'SystemStartBracket` (:481). Description: *"Connect staves vertically by adding a bracket on the left side. **The bar lines of the contained staves are connected vertically, too.**"* |
| `GrandStaff` | 521–532 | `\StaffGroup` + `systemStartDelimiter = #'SystemStartBrace` (:526); same description with "brace" |
| `PianoStaff` | 534–544 | `\GrandStaff` + `\alias GrandStaff` + `\consists Keep_alive_together_engraver` |
| `ChoirStaff` | 546–557 | `\StaffGroup` + **`\remove Span_bar_engraver` (:549)**. Description: *"**Identical to `StaffGroup` except that the contained staves are not connected vertically.**"* |
| `Score` | :815 | `systemStartDelimiter = #'SystemStartBar`, and **no** `Span_bar_engraver` — hence a bare `<< \new Staff … >>` gets no join |

⭐⭐ **`GrandStaff` differs from `StaffGroup` in the delimiter only; `ChoirStaff` differs in the span bar
only.** Two independent knobs on one context object — the cleanest demonstration in this whole survey
that **the bracket and the join are separate properties of a group**.

**The `SpanBar` grob.** Internals Reference (`lilypond.org/doc/v2.24/Documentation/internals/spanbar`)
and `scm/define-grobs.scm:3262–3283`: *"A span bar, i.e., the parts of a multi-staff bar line that are
outside of staves. See also SpanBarStub."* — *"SpanBar objects are created by: `Span_bar_engraver`."*
Object class **Item**; `(stencil . ,ly:span-bar::print)`, `(Y-extent . (+inf.0 . -inf.0))`,
`(allow-span-bar . #t)`, `(break-align-symbol . staff-bar)`.

The engraver, `lily/span-bar-engraver.cc:30–37`: *"Make bars that span multiple 'staves'. Catch bars,
and span a Span_bar over them if we find more than 2 bars."*; `ADD_TRANSLATOR` (`:163–164`): *"Make
cross-staff bar lines: It catches all normal bar lines and draws a single span bar across them."* It
acknowledges every non-span `BarLine`, and when `bars_.size() >= 2` makes one `SpanBar` holding them
all.

⭐ **The per-boundary escape is a property on the BarLine, not on the group** —
`scm/define-grob-properties.scm:47`: `(allow-span-bar ,boolean? "If false, no inter-staff bar line will
be created below this bar line.")` and `:1543`: `allow-span-bar-above`. **The ownership runs downward
from each bar line.**

`SpanBarStub` (`scm/define-grobs.scm:3284–3306`) is *"An auxiliary grob, acting like a fake SpanBar
grob in contexts such as Lyrics that are crossed by a span bar, to keep span bars taking horizontal
space."* — `lily/span-bar-stub-engraver.cc:33–49`: *"**SpanBarStubs exist for pure height calculations
ONLY. They should never be visually present on the page.**"*

⚠️ **Correction to a premise in the brief:** `\override SpanBar #'transparent` is **pre-2.18 syntax**
and appears nowhere in the current tree. The modern form is `\hide` (`ly/music-functions-init.ly:856–867`),
used as `\once \hide Score.SpanBar` in `input/regression/span-bar.ly:24`.

**3. `SystemStart*` is the LEFT EDGE, not the span bar — the distinction, spelled out.**
`staff.itely:245–250`: *"Each staff group context sets the property `systemStartDelimiter` to one of
the following values: `SystemStartBar`, `SystemStartBrace`, or `SystemStartBracket`. A fourth
delimiter, `SystemStartSquare`, is also available, but it must be explicitly specified."*
`scm/define-grobs.scm:3659–3717` — all four are `(class . Spanner)`, `(direction . ,LEFT)`, interface
`system-start-delimiter-interface`: `SystemStartBar` *"A bar line as a system start delimiter"*,
`SystemStartBrace` *"A brace…"*, `SystemStartBracket` *"A bracket…"*, `SystemStartSquare` *"A
rectangle-like bracket as a start delimiter."*

⇒ **`SystemStart*` are SPANNERS drawn once at each system's left edge; `SpanBar` is an ITEM created per
bar-line moment.** `SystemStartBar` merely *looks* like a barline (`(style . bar-line)`,
`(thickness . 1.6)`, `(padding . -0.1) ;; bar must cover rounded ending of staff line`) — it carries no
measure semantics, and LilyPond's own devs flag the oddity (`ly/engraver-init.ly:1058–1061`: *"It's a
little odd that the vertical lines separating squares are drawn by SystemStartBar at the beginning of
the line but BarLine elsewhere."*). ⭐ **And they are independent**: `ChoirStaff` keeps
`SystemStartBracket` while removing `Span_bar_engraver`.

**4. Mensurstrich — the documented recipe.**
`Documentation/snippets/mensurstriche-layout-bar-lines-between-the-staves.ly` (`\version "2.24.0"`),
included into the NR at `Documentation/en/notation/ancient.itely:3342–3343` (node *Mensurstriche
layout*) and referenced from `staff.itely:284`:

> *"**Mensurstriche**, bar lines between but not through staves, can be printed by setting
> `measureBarType` to `"-span|"` and using a grouping context that allows span bars, such as
> `StaffGroup`."*
> ```lilypond
> \layout { \context { \Staff  measureBarType = "-span|" } }
> \new StaffGroup << \new Staff \music  \new Staff \music >>
> ```

And the definition, `ancient.itely:3334–3340`: *"**Mensurstriche** ('mensuration lines') is the
accepted term for bar lines that are drawn between the staves of a system but not through the staves
themselves. It is a common way to preserve the rhythmic appearance of the original, i.e., not having
to break syncopated notes at bar lines, while still providing the orientation aids that bar lines
give."* ⭐ **This is the only real definition of Mensurstrich anywhere in this survey** — none of the
four treatises has one (§5.7).

The mechanism is `scm/bar-line.scm:1344`: `(define-bar-line "-span|" #t #f "|") ; mensurstrich` — i.e.
`\defineBarLine` with a **zero-width mid glyph** and a span glyph of `"|"`. `rhythms.itely:3688–3690`:
*"The argument span-bar has an effect only in multi-staff systems… where it specifies what to print
between grouped staves."*
⛔ **UNKNOWN**: the `measure-length` / `\remove "Bar_engraver"` idiom named in the brief is **not** a
documented Mensurstrich recipe in this tree (`\remove Bar_engraver` appears only in percussion and
neume contexts). Whether it survives as a legacy LSR snippet was not checked.

**5. Mid-score — ✅ yes, documented, per staff and per moment.**
`Documentation/snippets/removing-connecting-bar-lines-on-staffgroup,-pianostaff,-or-grandstaff.ly`:
*"By default, bar lines in `StaffGroup`, `PianoStaff`, or `GrandStaff` contexts are connected between
the staves, i.e., a span bar is printed. **This behaviour can be overridden on a staff-by-staff
basis.**"* — with `\once \override Staff.BarLine.allow-span-bar = ##f` in the body. Three levers, in
increasing bluntness: `allow-span-bar` at a moment; `\once \hide Score.SpanBar`; and
`\set Timing.measureBarType` (`rhythms.itely:3824–3826`), which switches to `"-span|"` mid-score.
⛔ **UNKNOWN**: `\override StaffGroup.SpanBar.stencil = ##f` is **not** documented anywhere in the tree
(only `.color` and `.glyph-name` overrides appear in regressions). Plausible, unsourced — do not cite.

**6. Affordance — ⛔ none. LilyPond is a text compiler.** Every mechanism above is a property write in
a `.ly` file; there is no GUI, no handle, no drag, in the distribution.

---

## 4. The file formats — what each considers the OWNING object

### 4.1 MusicXML 4.0

**Sources:** the W3C MusicXML 4.0 reference (`w3.org/2021/06/musicxml40/musicxml-reference/`, the route
`reference/README.md` records as live), accessed 2026-08-28, **double-sourced** against the
`musicxml.xsd` bundled at `~/dev/engine-sources/MuseScore/src/importexport/musicxml/schema/musicxml.xsd`,
which embeds the identical normative text as `xs:documentation`.

**`<group-barline>`** (`elements/group-barline/`; `musicxml.xsd:5894`):
> *"The group-barline type indicates if the group should have common barlines."*

**Its three values** (`musicxml.xsd:1896–1904`, matching `data-types/group-barline-value/`):
```xml
<xs:restriction base="xs:string">
  <xs:enumeration value="yes"/>
  <xs:enumeration value="no"/>
  <xs:enumeration value="Mensurstrich"/>
</xs:restriction>
```
⚠️ Note the case: **`Mensurstrich` is capitalised**, the other two are not.
⛔ **Caveat**: the spec gives *one* sentence for the whole type and **does not gloss each value** in
fetchable prose. The plain-English reading of `Mensurstrich` is standard terminology, **not a quoted
spec sentence**.

**`<part-group>`** (`musicxml.xsd:5958–5964`):
> *"The part-group element indicates groupings of parts in the score, usually indicated by braces and
> brackets. Braces that are used for multi-staff parts should be defined in the attributes element for
> that part. The part-group start element appears before the first score-part in the group. The
> part-group stop element appears after the last score-part in the group.*
> *The number attribute is used to distinguish overlapping and nested part-groups, **not the sequence
> of groups**. …*
> ***A part-group element is not needed for a single multi-staff part. By default, multi-staff parts
> include a brace symbol and (if appropriate given the bar-style) common barlines.** The symbol
> formatting for a multi-staff part can be more fully specified using the part-symbol element."*

**⛔ Can a barline join be expressed PER-MEASURE, or change mid-score? NO.**
- `<part-group>` is a child only of `<part-list>`, which is in the once-only `score-header` group
  (`musicxml.xsd:6547–6566`).
- The per-measure content model `music-data` (`musicxml.xsd:6514–6519`) permits exactly `note, backup,
  forward, direction, attributes, harmony, figured-bass, print, sound, listening, barline, grouping,
  link, bookmark`. **`part-group` is not in that list.**
- `part-list` order is *structural* (top-to-bottom staff order), not positional in time, and the spec
  says `number` distinguishes *"overlapping and nested part-groups, **not the sequence of groups**"*.
  A `<part-group>` cannot start "later in the score" because there is no later point in `<part-list>`.

⚠️ **This is an inference from the content model**, clearly marked — the spec has no sentence reading
"group-barline cannot change mid-score". It is corroborated by LilyPond's importer,
`~/dev/engine-sources/lilypond/scripts/musicxml2ly.py:747–756`: *"`<part-group>` elements are not
nested; they describe ranges instead… For bar lines this implies physical overwriting: A continuous
bar line always overwrites Mensurstriche."*

**⛔ `<barline>` carries no staff-span** (`musicxml.xsd:3225–3241`): *"**Barline data is on the same
level as the other musical data in a score — a child of a measure in a partwise score**, or a part in
a timewise score. This allows for barlines within measures, as in dotted barlines that subdivide
measures in complex meters."* Its attributes are `location`, `segno`, `coda`, `divisions`; its children
`bar-style`, `wavy-line`, `segno`, `coda`, `fermata`, `ending`, `repeat`. **None names a staff.**

**⭐ The join within ONE multi-staff part (a piano) is IMPLICIT.** `<part-symbol>`
(`musicxml.xsd:3098–3110`): *"…in a 3-staff organ part, the top-staff will typically be 1 for the
right hand, while the bottom-staff will typically be 2 for the left hand. Staff 3 for the pedals is
usually outside the brace. **By default, the presence of a part-symbol element that does not extend
across the entire part also indicates a corresponding change in the common barlines within a part.**"*
⇒ the brace's *extent* silently changes the join; there is no barline-span attribute on `<part-symbol>`
at all. ⭐ Note that this is **Gould p. 342 and Ross case 3 encoded as a default**: the organ pedal
staff falls outside the brace, and the barlines follow.
⚠️ **One structural asymmetry worth knowing**: `<part-symbol>` lives inside `<attributes>`, which *is*
measure-scoped and repeatable — so a *within-part* join is structurally capable of being redeclared at
any measure, unlike the cross-part join. ⛔ Whether any engine honours that is **UNKNOWN**.
⛔ **`<staff-details>` and `<print>` carry no barline-join semantics** — confirmed by reading the
content models, not inferred.

### 4.2 MEI

**Sources:** the MEI ODD on disk at
`~/dev/engine-sources/verovio/libmei/mei/mei-all_compiled.odd` (⚠️ `<edition>MEI 6.0-dev</edition>`,
commit `6da4dd50`), **cross-checked against the published v5 guidelines** at
`music-encoding.org/guidelines/v5/` (accessed 2026-08-28).

`<staffGrp>` (ODD :34627): *"A group of bracketed or braced staves."* Content model:
`grpSym*, model.labelLike*, model.instrDefLike*, (model.staffGrpLike | model.staffDefLike)+, grpSym*`
— i.e. **staff groups nest**.

**`@bar.thru`** (`att.staffGrp.vis`, ODD :37314–37334; confirmed identical at
`music-encoding.org/guidelines/v5/attribute-classes/att.staffGrp.vis.html`):
> *"**bar lines through** — Indicates whether bar lines go across the space between staves (true) or
> are only drawn across the lines of each staff (false)."* Data type `data.BOOLEAN`.
> Remark: *"This attribute is ignored when the `bar.method` attribute's value is `mensur` or `takt`."*

Guidelines prose (`guidelines/v5/content/cmn.html`): *"The **bar.thru** attribute on staffGrp allows
one to specify whether bar lines are drawn across the space between staves of that group or only on
the staves themselves."* and *"**The staffGrp element is also used for the two staves of a grand
staff.**"*

⭐ **The older spelling is confirmed**: `guidelines/v3/content/cmn.html` reads *"The **@barthru**
attribute on staffGrp…"* ⇒ **`@barthru` (MEI 3) → `@bar.thru` (MEI 4/5/6)**, otherwise word-identical.

**⭐⭐ MEI is the only format with TWO ORTHOGONAL AXES.** `att.barring` gives `@bar.method`
(`data.BARMETHOD`, ODD :16641–16656), a closed list:
- `mensur` — *"Between staves only."*
- `staff` — *"Between and across staves as necessary."*
- `takt` — *"Short bar line through a subset of staff lines."*

with `@bar.len` and `@bar.place` alongside. **`bar.method` wins**: `bar.thru` is explicitly ignored
under `mensur`/`takt`. ⇒ MEI separates *where lines are drawn* from *whether they cross the gap*,
where MusicXML crams both into one 3-valued element. That is cleaner, and Verovio's importer targets
exactly this split (§4.4).

**The grouping symbol.** ⚠️ **Terminology correction to the brief:** there is no `<symbol>` element for
this (MEI's `<symbol>` is *"A reference to a previously defined symbol"*, unrelated). It is either the
**`@symbol` attribute** on `<staffGrp>` (`att.staffGroupingSym`, ODD :31468–31492 — closed list
`brace` / `bracket` / `bracketsq` / `line` / `none`) or the **`<grpSym>` element** (ODD :33507–33534,
*"A brace or bracket used to group two or more staves of a score or part"*, *"an alternative to the
staffGrp element's @symbol attribute… when exact placement or editorial details for the grouping
symbol must be recorded"*).
⭐ **MEI keeps bracket and join fully orthogonal** — `@symbol` and `@bar.thru` are separate attributes
from separate classes on the same element, and nothing in the ODD makes one imply the other.
⚠️ *That last sentence is a structural inference from the schema*, corroborated only by the fact that
`bar.thru`'s description never mentions the grouping symbol.

**✅ Mid-score — yes, and it is documented.** Schema chain: `<section>` → `model.sectionPart` →
`model.scoreDefLike` → `<scoreDef>` → `model.staffGrpLike` (ODD :34386, :32516–32520, :34370). And the
prose (ODD :1285, **confirmed word-for-word at `guidelines/v5/content/shared.html` §2.2.1**):
> *"The character of elements specifying one or more score or staff parameters… is that of a
> **milestone; that is, they affect all subsequent material until a following redefinition**. A
> `scoreDef` element, which may affect more than just one staff, is allowed only within `score`, `part`
> and `section` elements."*

Resolution order, ODD :5271: *"As a general rule, **the closest preceding and most specific element
provides this information**."*
⚠️ **Provenance split**: the *milestone* sentence is v5-confirmed; the ODD's bulleted list of legal
`scoreDef` placements (:5596–5601) is **6.0-dev only** — the v5 fetch returned a partial page.

⇒ **MEI is the only one of the three formats where the join can legally and idiomatically change
mid-score.**

### 4.3 ⭐ What the ENGINES actually do with `<group-barline>` — a lossiness finding

- **MuseScore collapses `Mensurstrich` into `yes`.**
  `~/dev/engine-sources/MuseScore/src/importexport/musicxml/internal/import/importmusicxmlpass1.cpp:2379–2381`:
  ```cpp
  } else if (m_e.name() == "group-barline") {
      if (m_e.readText() == "no") { barlineSpan = false; }
  }
  ```
  `barlineSpan` defaults `true` (`:2360`) — only `"no"` is tested. Export is equally lossy:
  `exportmusicxml.cpp:4777–4778` always writes `xml.tag("group-barline", "yes")` and never emits
  `Mensurstrich`.
- **Verovio honours all three** — `~/dev/engine-sources/verovio/src/iomusxml.cpp:1015–1017` (§4.4).
- **LilyPond's `musicxml2ly.py:813–822`** maps `Mensurstrich` → `barline = False` +
  `spanbar_to_staff_below = True`, and `yes` → `barline = True` + `spanbar_to_staff_below = True`.

⇒ Round-tripping a Mensurstrich score through MuseScore loses it. Worth knowing before treating
`<group-barline>` as a faithful interchange for the join.

### 4.4 ⭐⭐ What the ENGINE SOURCES say — read first-hand from `~/dev/engine-sources`

These are checkouts we already hold (`reference/README.md` §"ENGINE SOURCES"). Code is an
*implementation*, not an authority — but it is the most direct statement of **what owns the join**,
which is exactly the question asked.

#### LilyPond — the join is ONE ENGRAVER in a CONTEXT, and it is independent of the bracket

`ly/engraver-init.ly`, read at HEAD of the local checkout:

| context | line | what it declares |
|---|---|---|
| `StaffGroup` | **:468–474** | `\consists Span_bar_engraver` — description: *"Connect staves vertically by adding a bracket on the left side. **The bar lines of the contained staves are connected vertically, too.**"* |
| `GrandStaff` | **:523–534** | `\StaffGroup` + `systemStartDelimiter = #'SystemStartBrace` — description: *"Connect staves vertically by adding a brace on the left side. **The bar lines of the contained staves are connected vertically, too.**"* |
| `PianoStaff` | **:536–545** | `\GrandStaff` + `Keep_alive_together_engraver` — *"Just like `GrandStaff`, but the staves are only removed together, never separately."* ⇒ **barline behaviour identical to GrandStaff.** |
| `ChoirStaff` | **:547–557** | `\StaffGroup` + **`\remove Span_bar_engraver`** — description: *"**Identical to `StaffGroup` except that the contained staves are not connected vertically.**"* |

⭐⭐ **This is the cleanest demonstration in the whole survey that the bracket and the join are two
independent properties of one group object.** `GrandStaff` differs from `StaffGroup` in the
*delimiter only*; `ChoirStaff` differs from `StaffGroup` in the *span bar only*. Two knobs, one
context. And `ChoirStaff`'s existence is Gould p. 463 and Stone p. 7 compiled into a context name.

⚠️ Note the two DIFFERENT objects, again: `systemStartDelimiter` (`SystemStartBar` / `SystemStartBrace`
/ `SystemStartBracket` / `SystemStartSquare`) is the **left-edge** mark; `Span_bar_engraver` →
`SpanBar` is the **interior** join. Conflating them is the standard mistake.

#### MuseScore — ⭐⭐ BOTH a staff default AND a per-barline override, and a MODIFIER picks

Read first-hand from the local checkout:

- **The staff default**: `src/engraving/dom/staff.h:273` — `bool m_barLineSpan = false; // true - span
  barline to next staff`, with `barLineSpan()` / `setBarLineSpan()` at `:131` / `:134`.
  ⭐ It is seeded **from the instrument template**: `staff.cpp:1154` — `setBarLineSpan(t->barlineSpan[templateStaffIdx])`.
  So MuseScore's DEFAULT for a piano/choir/section comes out of the instrument definition, not out of
  a house style.
- **The per-element override**: `src/engraving/dom/barline.h:178–179` — `bool m_spanStaff = false;
  // span barline to next staff if true` and `int m_spanFrom = 0; // line number on start and end staves`
  (with `m_spanTo`). Every layout re-seeds it from the staff — `measurelayout.cpp:782, 791, 929, 939`:
  `bl->setSpanStaff(staff->barLineSpan())`.
- ⭐⭐ **The gesture, in code.** `BarLine::gripsPositions` (`barline.cpp:531–544`) returns **exactly ONE
  grip** — the top one is commented out at `:541` — positioned at the barline's **bottom** end. So an
  edit-mode barline in MuseScore shows **one square, at the bottom**, and you drag it down.
  `BarLine::dragGrip` (`:597+`) moves `yoff2` continuously, clamped between *"min for bottom grip is 1
  line below top grip"* and *"max is the bottom of the system"*. On release, `endEdit` snaps to the
  nearest staff by a midpoint test and writes the property.
- ⭐⭐ **And the modifier decides WHAT the drag writes** — `barline.cpp:579` and `:675`:
  ```
  bool local = ed.control() || segment()->isBarLineType() || spanStaff() != score()->staff(staffIdx())->barLineSpan();
  ```
  With **Ctrl** (or on a barline that already deviates), the change is written to **that one
  `BarLine` element** (`Pid::BARLINE_SPAN`). **Without Ctrl** it is written to the **STAFF**
  (`Pid::STAFF_BARLINE_SPAN`), i.e. it applies to that staff for the whole score.
- **Keyboard equivalent**: `BarLine::isEditAllowed` (`:567–571`) — **↓ extends** the span when it is
  not spanning, **↑ retracts** it when it is. Same `local` test, same two destinations.
- ⭐ **The span is a CHAIN of per-boundary booleans, not a range**: `endEdit` loops
  `for (staffIdx1 … staffIdx2) → setSpanStaff(true)` and then breaks the last one. "Span" means
  *continue to the next staff down*, which is the same shape as Ross's *"and thereafter…"* framing.

#### Verovio — the join is `@bar.thru` on `<staffGrp>`, INHERITED, and default OFF

- `src/barline.cpp:87–95`, `BarLine::IsDrawnThrough(const StaffGrp *)` — walks **up** the `staffGrp`
  ancestor chain for the first one that `HasBarThru()`, and **returns `false`** if none does.
  ⇒ inheritance through nested groups, default not-joined.
- `src/iomei.cpp:9126–9128` — reads the MEI attribute spelled **`barthru`** into `SetBarThru`.
- ⭐ **The MusicXML mapping, first-hand** — `src/iomusxml.cpp:1016–1017`:
  ```
  if (!groupBarline.empty()) staffGrp->SetBarThru((groupBarline == "no") ? BOOLEAN_false : BOOLEAN_true);
  if (groupBarline == "Mensurstrich") staffGrp->SetBarMethod(BARMETHOD_mensur);
  ```
  ⇒ **`Mensurstrich` counts as JOINED**, plus a *separate* `@bar.method="mensur"`. MEI models
  Mensurstrich as a **method**, not as a third value of "thru".
- ⭐⭐ **The join inside one multi-staff part is IMPLICIT** — `src/iomusxml.cpp:1143–1147`: when a
  MusicXML `<part>` has more than one staff, Verovio synthesises a `<staffGrp>` and sets
  `SetBarThru(BOOLEAN_true)` plus a **brace**, with nothing in the file having said so. That is the
  direct answer to "does MusicXML encode the piano grand-staff join?" — **it does not; it is inferred
  from `<staves>2</staves>`.**

---

## 5. The engraving authorities — what a JOINED barline MEANS, and when

⭐ All four treatises below are **on disk** in `reference/` (see `reference/README.md`). Every quote
here was read out of the local full text, not from a summary. Page numbers are the PRINTED pages.

### 5.1 ⭐⭐ The one-sentence rule: THE JOIN FOLLOWS THE BRACKET

> *"Barlines join instrumental sections, separating them in exactly the same places as margin
> brackets. This separation helps to make the position of an instrument on the page clear. **Barlines
> are continuous from the top to the bottom of the system only where the margin brackets are likewise
> continuous.** When an ensemble comprises more than two separate groups, barlines may join all staves
> of each group, to clarify the group separation."*
> — **Gould, *Behind Bars*, p. 518** (*Score brackets and barlines ▸ Barring through a score*; running heads bracket it to pp. 517–518),
> `reference/gould-behind-bars-fulltext.txt:33037–33044`

This is the crux answer to "what owns the join": **Gould makes it a property of the BRACKETED GROUP,
not of the barline and not of the staff.** The bracket and the barline are two faces of one grouping
decision, and she states the identity explicitly (*"in exactly the same places"*).

And for completeness, the two bracket rules the join is said to follow:

> *"The curly bracket, also called a brace, connects the staves of instruments that use two staves:
> most commonly keyboard and harp. Extend the brace to three or four staves for piano writing if
> necessary."* — **Gould p. 514** (*Curly braces*), `…txt:32753–32757`

> *"The square bracket is beam thickness and has curved ends. In an orchestral score it joins the
> staves of each instrumental section. When a score is divided into separate ensemble groups or vocal
> choirs, the square bracket joins the staves of each group individually. … A concerto soloist,
> concertante group or solo vocal line does not take a margin bracket, since none of these forms part
> of a larger group."* — **Gould p. 516** (*Square brackets*), `…txt:32923–32940`

Gerou & Lusk say the same thing in one line, with a figure:

> *"Barlines are used to group staves of like instruments in a score layout."*
> — **Gerou & Lusk, *Essential Dictionary of Music Notation*, the *Barlines* entry, pp. 25–28**,
> `reference/gerou-lusk-essential-dictionary-of-music-notation.txt:1200–1205`.
> Their figure labels the two cases **"systemic barline"** and **"break barline"** — i.e. they name
> the *interruption* as its own object.

### 5.2 ⭐⭐ The SYSTEMIC barline is a separate thing from a joined barline

> *"A barline connects all staves at the beginning of a system. This particular barline is called the
> **systemic barline** (see p. 521). A single-stave part does not have this barline at the beginning
> of the stave."*
> — **Gould p. 38** (*Barlines*), `gould-behind-bars-fulltext.txt:2948–2950`

> *"The depth of a system is defined solely (in many cases) by the barline that joins the left-hand
> edge of all staves of a system. **Except in a homogeneous ensemble (e.g. a string quartet), this
> will be the only barline joining the whole system.** The systemic barline should be used to define
> the system depth at all times, including where a bar is divided over a page or system break."*
> — **Gould p. 521** (*Defining systems ▸ The systemic barline*), `…txt:33130–33138`

⭐ **This is the single most important distinction in the whole survey.** The line at the LEFT EDGE
always joins everything, unconditionally, and is not the same object as the barlines inside the
system. Every program below keeps the two separate (LilyPond most explicitly: `SystemStartBar` vs
`SpanBar`), and so do we (`ScoreRenderer.drawSystemConnector` vs `BarlineRenderer`).

Ross states it the same way and gives it the same name:

> *"A **'systemic' barline**, which connects the beginning of two or more staves, is used for keyboard
> instruments with two-stave systems (piano, organ, accordion, harp). Connecting barlines are also
> used throughout the rest of the music."*
> — **Ross, *The Art of Music Engraving and Processing*, p. 151** (case 2 of seven),
> `reference/ross-art-of-music-engraving-fulltext.txt:9294–9297`

### 5.3 ⭐⭐ Ross's SEVEN CASES — the most explicit "which staves join" table in any book we hold

**Ross pp. 151–152**, *Barlines* (`ross-…-fulltext.txt:9288–9341`), verbatim, condensed to its heads:

| # | ensemble | what Ross says |
|---|---|---|
| 1 | single-line music | *"the barline connects the top and bottom lines of the staff"* |
| 2 | **piano, organ, accordion, harp (2-stave)** | systemic barline at the start; *"Connecting barlines are also used throughout the rest of the music"* — i.e. **joined everywhere** |
| 3 | **organ, 3-stave** | systemic barline joins all three at the start; *"But thereafter, connecting barlines are used only for the first two staves (the two manual staves and stops). The third (pedal) staff has its own barline vertically aligned with the manual barlines"* |
| 4 | **piano-vocal ("sheet music")** | systemic barline joins all three; *"After the systemic barline, the barlines in the top (vocal) staff are treated the same as in a single line of music. But the barlines for the piano part connect both staves, and are vertically aligned with the barlines of the vocal staff"* |
| 5 | **vocal ensemble and hymn** | systemic barline; *"But then there are vertically aligned, **separate** barlines for each staff… If a piano accompaniment is included with the vocal part, the systemic barline includes the piano staves. The rest of the piano part has connecting barlines vertically aligned with voice-part barlines"* |
| 6 | **orchestra / band** | systemic barline; *"Thereafter, connecting barlines are used for each section, such as brass, reeds, percussion, and strings."* ⚠️ **Condensed score is the exception**: *"there is a systemic barline, and thereafter barlines connect all sections (the only exception here is the percussion part, which, after the systemic barline, is treated as a single staff)"* |
| 7 | **string / brass / reed and other ensembles** | *"have systemic barlines, and thereafter connecting barlines"* — i.e. joined throughout |

⭐ Note the SHAPE of Ross's table: every case is stated as **"the systemic barline, and THEREAFTER
…"**. The join is answered separately for the left edge and for the interior, in every single case.

### 5.4 ⭐⭐ Stone's list — a second, independent, and slightly DIFFERENT seven

**Stone, *Music Notation in the Twentieth Century*, pp. 6–8**, *Barlines* A–D
(`reference/stone-notation-20th-century-fulltext.txt:1520–1600`):

- **Harp** — *"the barlines connect both staves"*
- **Organ** — *"the barlines connect only the manual staves; the pedal staff is barred separately,
  except at the beginning of each line; there, the curved brace covers the two manual staves only,
  while **the straight line that follows must always connect all three**."* ⭐ The clearest statement
  anywhere that the systemic line and the brace have DIFFERENT extents.
- **Piano** — *"the barlines connect both staves. If more than two staves are needed, it may be
  advantageous to bar the right- and left-hand staves separately, the musical texture permitting.
  (This does not, however, affect the brace at the beginning of each line: while each of the two hands
  might have its own curved brace, the straight line that follows must always connect all staves.)"*
- **One-staff instruments and voice** — added staff-lines for unpitched effects *"should have short
  barlines not connected to the barlines of the pitched staff, except at the beginning of the line."*
- **One or more soloists with accompaniment** — *"the solo staff should be barred separately."*
- **Duos/trios/quartets on single staves** — *"all staves should be barred together. In cases of a
  single nonfamily member (clarinet quintets, for example), the nonmember generally is barred
  separately. If a piano or other two-staff instrument is included (e.g., a piano trio), it must be
  barred separately. In such cases the other instruments are often barred separately too."*
- **Vocal or choral ensembles** — *"each staff must be barred separately, although choral music is
  occasionally barred together when condensed onto two staff-lines."*
- **Orchestra/band** — *"Instrumental families should be barred together as follows: woodwinds;
  brasses; percussion; harp(s); keyboard(s) (each harp and/or keyboard instrument separately);
  instrumental solo(s); vocal solo(s); chorus; strings"*. Footnote: *"Vocal parts and instrumental
  solos are barred separately. If the full score includes a chorus, it is best (the musical texture
  permitting) to condense it onto two staves and to bar the two staves together, **regardless of the
  barlines' possible interference with the text**. Such an arrangement makes the total picture clearer
  for the conductor."*
- ⭐ And a **percussion** rule that is a real disagreement with Ross's case 6: *"It is generally not
  advisable to bar different kinds of percussion instruments, notated on separate lines, together."*
  Ross's condensed score bars percussion as a single staff; Stone subdivides pitched from unpitched
  *"and the barlines should show such groupings."*

### 5.5 ⭐⭐ VOCAL STAVES ARE NOT JOINED — three sources, one reason, one exception

- **Gould p. 519**: *"Each vocal stave takes separate barlines, **so that barlines do not intersect
  the text**."* (`…txt:33049–33050`)
- **Gould p. 463** (*Choral writing ▸ Barlines*): *"A barline at the left-hand edge of the system (the
  systemic barline) connects the whole choir and any accompaniment staves. **Otherwise, each vocal
  stave always has separate barlines, to avoid intersecting the text.**"* (`…txt:29734–29737`)
- **Ross p. 152**, case 5: vocal ensemble and hymn — *"vertically aligned, separate barlines for each
  staff."*
- **Stone p. 7**: *"Vocal or choral ensembles: each staff must be barred separately."*

⭐ **The reason is stated identically twice by Gould and it is LYRICS, not grouping** — which means
the rule is not "vocal music is special", it is "a barline may not run through text". The **exception**
is Stone's condensed-chorus footnote above, where a conductor's score wins over the lyrics.

⛔ Note what this does to the "join follows the bracket" rule of §5.1: **choral staves ARE bracketed
and are NOT joined.** The bracket rule is therefore a default, not an identity — Gould states both,
eleven printed pages apart, without reconciling them. So an implementation cannot derive the join
from the bracket alone.

### 5.6 Keyboard — the two defaults, stated outright

- **Gould p. 332** (*Layouts of three or more staves*): *"**The curly brace and barlines join all
  staves of a system.**"* (`…txt:19925`) — piano, including 3- and 4-stave layouts.
- **Gould p. 342** (*Organ notation ▸ System layout*): *"The manual staves are braced together; the
  pedal stave is excluded from the brace. **It is essential that the pedal stave has separate
  barlines: the player requires the visual separation of manual and pedal staves.**"* (`…txt:20578–20581`)
- **Gould p. 330** (*Player with two keyboards*): *"Assign each stave or pair of staves **individual
  curly braces and barlines**. (The systemic barline on the left-hand side of the music always joins
  the whole system.)"* (`…txt:19857–19859`)
- **Gould p. 518**: *"**Each braced part takes separate barlines**, as does a concerto soloist."*
  ⚠️ Read in context this means the braced part's barlines are separate **from the rest of the
  score**, not that its own two staves are split — p. 332 says the opposite about its own staves.

### 5.7 ⛔ MENSURSTRICH — **UNKNOWN in our library**

`grep -i "mensurstrich\|mensur"` across all four full texts returns **three hits, none of them about
barlines**: Stone's historical note on mensural notation (p. 2 region) and Gould's *"non-mensural
notation"* in the spacing chapter. **Neither Gould, Ross, Stone nor Gerou & Lusk contains a
Mensurstrich rule, section, or index entry.** This is a *checked negative*, recorded so nobody reads
those four books for it again.

The nearest thing any of them has is Stone's **dotted barline**, which is a different device:

> *"Dotted barlines … are used for subdividing complicated meters … **and in new editions of old music
> to distinguish between the original barlines (solid lines) and those added by the editor (dotted
> lines)**."* — **Stone p. 8** (*Barlines ▸ E. Dotted Barlines*), `…txt:1628–1632`

⛔ That is *editorial* barring, not Mensurstrich (barlines drawn ONLY in the gaps between staves).
⭐ The only sourced DEFINITION of Mensurstrich in this survey is **LilyPond's** (`ancient.itely:3334–3340`, quoted in §3.5); the only sourced encodings are MusicXML's
`<group-barline>Mensurstrich</group-barline>` and MEI's `@bar.method="mensur"` — see §4. **We hold no treatise source for what it
means or when it is used**, and I did not go looking online for one, since the question asked was what
the authorities say.

### 5.8 ⛔ Other checked negatives

- **No treatise states what happens to REPEAT DOTS on a joined barline.** Already established and
  recorded in `docs/plans/barline-types-plan.md` §4.5; re-confirmed here. All three engines agree the LINES
  run between staves and the DOTS do not, and that fact rests on code alone.
- **No treatise describes a USER GESTURE**, obviously — they are engraving books. Every "user action"
  finding in this report comes from an application manual.

---

## 6. What maps onto OUR objects

⛔ No design, no phases, no code — just which existing object each answer lands on.

### 6.1 What we have today

| our thing | file | what it does about joining |
|---|---|---|
| `StaffGroup { id, staffIds, symbol?: 'brace' \| 'bracket' }` | `src/types/music.ts:2258` | grouping exists; **no barline-join field**, and `symbol` rendering is deferred (`docs/plans/multi-staff-plan.md` §11) |
| `Score.staffGroups?: StaffGroup[]` | `src/types/music.ts:2307` | a list, length 1 today; written in exactly one place (`ScoreModel.ts:284–293`) |
| the **systemic barline** | `ScoreRenderer.drawSystemConnector` (`:4369`), called at `:4040` | drawn by hand, top staff line 0 → bottom staff's last line, at **every** system's first measure, `if (staffList.length > 1)` — **unconditional, and it does not consult `StaffGroup` at all** |
| every **interior** barline | `engine/rendering/staff/BarlineRenderer.ts` | one line **per placement**, i.e. per measure per staff, in a group keyed `barline-{measure}-{staffIndex}-{side}` (`:327`). There is no between-staff segment and no span object. |
| the sign's **extent** | `engine/layout/barlineSign.ts` | ⭐ "ONE OWNER FOR THE SIGN'S EXTENT" — but it is the **horizontal** extent (strokes and dots in staff spaces). The **vertical** extent is not modelled anywhere; each drawn line simply takes its own stave's height. |
| the **per-staff scope** field | `docs/plans/barline-types-plan.md` §2 | already stored, **absent = the whole system**, *"Nothing in P1 reads it"* |

⭐ So the shape our code already has is **exactly Gould's p. 521 split**: the left-edge line is one
object (`drawSystemConnector`) and the interior lines are another (`BarlineRenderer`). That is the
same split LilyPond makes (`SystemStartBar` vs `SpanBar`) and the same split every treatise makes
(*"the systemic barline, and thereafter…"*).

### 6.2 Where each program's answer would land

| the program's owning object | our object it maps onto |
|---|---|
| a **bracket/brace group property** (Sibelius, Dorico, Finale group, LilyPond context, MusicXML `<part-group>`, MEI `<staffGrp>`) | **`StaffGroup`** — an added field, one row, no new object. This is the majority answer and the one our model is already shaped for. |
| a **per-staff span** (MuseScore's `Staff::barLineSpan` / `spanFrom` / `spanTo`) | **nothing we have.** Closest is `docs/plans/barline-types-plan.md` §2's stored-but-unread per-staff scope — but that scope answers *"which staves carry this SIGN"*, which is a different question from *"how far down does this LINE reach"*. ⚠️ Do not conflate them. |
| a **global engraving option** | **nothing we have** — we have `engravingOverrides`, but that compartment is *anchor-relative per-item offsets*, not house style. |
| a **mid-score change** | **nothing we have.** `Score.staffGroups` is score-global, which is precisely the `score.clef` conflation `docs/DESIGN-PRINCIPLES.md` §6 forbids: a group stored on `Score` silently means "the grouping at bar 1". |
| a **per-barline vertical drag** | **nothing we have**, and note that `barlineSign.ts` is horizontal-only — a vertical extent has no owner today. |

### 6.3 The three facts worth carrying forward

1. **The vertical extent of a barline has no owner in our code.** `barlineSign.ts` owns the horizontal
   extent and says so loudly; the vertical is implicit in "whatever stave this placement has". Anything
   that joins staves needs a second owner, and the reason `barlineSign.ts` gives for having ONE owner
   (four consumers — drawing, reserved width, hit box, highlight) applies to the vertical unchanged.
2. **`drawSystemConnector` already ignores `StaffGroup`.** It joins top to bottom whatever the grouping
   says. Under Gould p. 521 that is *correct for the systemic barline* — but it means we currently have
   no code path that has ever asked a `StaffGroup` a question.
3. **A group that can change mid-score is a different object from `Score.staffGroups`.** Every source
   below that supports mid-score change does it by re-declaring the grouping at a point in time (MEI's
   mid-`<section>` `<scoreDef>`; LilyPond's context structure being fixed but overridable at a moment).
   Our `Score.staffGroups` cannot express a point in time.

### 6.4 Two more facts about our current UI, since the question is a GESTURE question

- **A barline is already selected as ONE system-wide thing.** `interactions/elements/barline.ts`:
  registered *"per (measure, staff) — the ink is drawn once per staff — but selected as ONE
  system-wide thing (the `barline` element kind), so whichever staff the click lands on, the whole
  line is what gets picked."* ⇒ our selection identity is already the whole-system line, which is the
  identity a join gesture would need.
- **Its hit box stops at the staff.** Same file: the pad is horizontal only — *"NOT vertically: the box
  is exactly the five staff lines, and **a click in the gap between two staves is on no barline at
  all**."* ⇒ today there is nothing to grab between two staves.
- ⭐ **We already have the square-handle idiom.** `interactions/elements/hairpinHandles.ts`,
  `ottavaHandles.ts`, `trillHandles.ts` — the END SQUARES pattern. So "a visible square you drag" is
  not a new UI primitive here, it is an existing one that the barline does not use.
- **`BarlineStatement.staffId?`** (`src/types/music.ts:2024–2025`): *"Which staff this governs;
  **absent = the whole system**. Stored, not yet read (plan §2)."* Same optional field on
  `RepeatStart` / `RepeatEnd`.

---

## 7. Recommendation — ⚠️ opinion, clearly separated from the findings above

Short, and it is not a plan.

1. **Answer the user's literal question first: yes, Sibelius drags, and yes it shows a square.** So does
   MuseScore 4. The direct-manipulation gesture he was unsure about is the majority gesture among the
   two programs that have one, and it is the same gesture in both: *click the barline's end → a square
   handle appears → drag it vertically → it snaps to a staff.*
2. **But the drag is a DOOR, not a model.** Every program that drags still writes the result somewhere
   else: Sibelius into a score-global extent, MuseScore into a per-barline boolean *or* a per-staff
   default depending on **Ctrl**. Nobody stores "this barline is 3 staves tall" as the truth. The
   question *what owns the join* is answered by five of the six sources as **the group** (Dorico,
   Finale, LilyPond, MusicXML, MEI), and by MuseScore as **a chain of per-boundary booleans**.
3. **The cheapest honest model is LilyPond's `allow-span-bar` / MuseScore's `spanStaff` shape**: a
   boolean meaning *"continue to the next staff down"*, resolved per boundary. It matches Ross's seven
   cases (every one phrased as *"the systemic barline, and thereafter…"*), it matches
   `barlineSign.ts`'s existing stance that a boundary owns its own extent, and it makes a 4-staff join
   three booleans rather than a new range object.
4. **Do not derive the join from the bracket.** Gould states the identity (p. 518) *and* the vocal
   exception (p. 463/519) eleven pages apart without reconciling them; Sibelius says brackets and joins
   coincide *"often, but by no means always"*; MuseScore's brackets have nothing to do with barlines at
   all. The bracket is a good **default**, never a derivation.
5. **If Mensurstrich is ever wanted, copy MEI's two axes, not MusicXML's one.** `@bar.method`
   (`staff`/`mensur`/`takt`) × `@bar.thru` (boolean) survives contact with Mensurstrich without a
   special case; MusicXML's single 3-valued `<group-barline>` does not, and MuseScore's importer
   silently drops the value to prove it.
6. **The vertical extent needs an owner, the way the horizontal one already has.**
   `barlineSign.ts`'s own argument — four consumers (drawing, reserved width, hit box, highlight) must
   not each compute the number — applies unchanged to a vertical extent, and there is no such owner
   today.

---

## 8. Sources

**On disk (`reference/`, gitignored, manifest at `reference/README.md`):**

1. **Gould, Elaine — *Behind Bars*** — `reference/Behind Bars … (2).pdf` + `gould-behind-bars-fulltext.txt`.
   Pages used: **38** (barlines / systemic barline), **330** (two keyboards), **332** (piano, 3+ staves),
   **342** (organ), **463** (choral barlines), **514** (curly braces), **516** (square brackets),
   **518** (*Barring through a score*), **519** (vocal staves + small ensembles), **521** (*The systemic
   barline*).
2. **Ross, Ted — *The Art of Music Engraving and Processing*** — `ross-art-of-music-engraving-fulltext.txt`.
   Pages **151–152**, *Barlines* — the seven cases.
3. **Stone, Kurt — *Music Notation in the Twentieth Century*** — `stone-notation-20th-century-fulltext.txt`.
   Pages **6–8**, *Barlines* A (individual instruments) / B (chamber and choral) / C (orchestra and
   band) / D (vertical alignment) / E (dotted barlines).
4. **Gerou & Lusk — *Essential Dictionary of Music Notation*** — `gerou-lusk-…-fulltext.txt`, the
   *Barlines* entry, pp. **25–28**.

**Engine checkouts (`~/dev/engine-sources`, read first-hand 2026-08-28):**

5. **LilyPond** HEAD `beedbfa0` (3 Aug 2026) — `ly/engraver-init.ly:466–560, 815, 1058–1061`;
   `scm/define-grobs.scm:3262–3306, 3659–3717`; `scm/define-grob-properties.scm:47, 1543`;
   `scm/bar-line.scm:140–160, 1344`; `lily/span-bar-engraver.cc:30–164`;
   `lily/span-bar-stub-engraver.cc:33–49`; `Documentation/en/notation/staff.itely:139–290`,
   `…/rhythms.itely:3688–3690, 3797–3800, 3824–3826`, `…/ancient.itely:3329–3390`;
   `Documentation/snippets/mensurstriche-layout-bar-lines-between-the-staves.ly`;
   `Documentation/snippets/removing-connecting-bar-lines-on-staffgroup,-pianostaff,-or-grandstaff.ly`;
   `input/regression/span-bar.ly`, `span-bar-allow-span-bar.ly`, `span-bar-partial.ly`;
   `scripts/musicxml2ly.py:747–756, 813–822`.
6. **MuseScore** master — `src/engraving/dom/barline.h:106–111, 178–179`;
   `src/engraving/dom/barline.cpp:531–544, 554–592, 597–720`; `src/engraving/dom/staff.h:131–134, 273`;
   `src/engraving/dom/staff.cpp:1154`; `src/engraving/dom/instrtemplate.cpp` (`barlineSpan`);
   `src/engraving/rendering/score/measurelayout.cpp:782, 791, 929, 939`;
   `src/importexport/musicxml/internal/import/importmusicxmlpass1.cpp:2360, 2379–2381`;
   `src/importexport/musicxml/internal/export/exportmusicxml.cpp:4777–4778`;
   `src/importexport/musicxml/schema/musicxml.xsd` (the MusicXML 4.0 normative text).
7. **Verovio** — `src/barline.cpp:87–95`; `src/iomusxml.cpp:1015–1017, 1143–1147`;
   `src/iomei.cpp:9126–9128`; `libmei/mei/mei-all_compiled.odd` (⚠️ MEI **6.0-dev**, commit `6da4dd50`).

**Program documentation (all accessed 2026-08-28):**

8. **Sibelius Reference Guide, version 2022.3**, Avid, PN 9329-66370-00 REV A 3/22 —
   `https://resources.avid.com/SupportFiles/Sibelius/2022.3/Sibelius_Reference.pdf`.
   §4.5 *Barlines* (pp. 341, 343–344), §4.19 *Brackets and Braces* (p. 398), Edit Staff Type (p. 188).
9. **Dorico Pro 4** — `archive.steinberg.help/dorico/v4/en/dorico/topics/…`:
   `notation_reference_barlines_across_staff_groups_c.html` ·
   `notation_reference_barlines_custom_joins_inputting_t.html` ·
   `notation_reference_barlines_project_wide_engraving_options_c.html` ·
   `notation_reference_barlines_per_flow_notation_options_c.html` ·
   `notation_reference_barlines_moving_graphically_t.html` ·
   `notation_reference_brackets_braces_ensemble_type_r.html` ·
   `notation_reference_brackets_braces_custom_grouping_c.html` ·
   `notation_reference_brackets_braces_custom_grouping_resetting_t.html` ·
   `engrave_mode_formatting_panel_r.html`.
10. **Dorico 1** (for the one topic whose v4 path could not be found) —
    `archive.steinberg.help/dorico/v1/…/notation_reference_barlines_across_staves_time_signature_changes_showing_t.html`.
11. **Finale user manuals** (⚠️ current `FinaleMac/`/`FinaleWin/` trees **403**; versioned trees work) —
    `http://usermanuals.finalemusic.com/Finale2014Win/Content/Finale/`: `Barlines.htm` · `GROUPDLG.htm` ·
    `Groups.htm` · `Brackets_Staves.htm`; and `Finale2012Mac/Content/Finale/ISDLG.htm`.
12. **MuseScore Studio handbook** — `https://handbook.musescore.org/notation/rhythm-meter-and-measures/barlines` ·
    `…/alternative-notation/mensural-notation-and-mensurstrich` ·
    `…/notation/instruments-staves-and-systems/brackets` · `…/basics/adjusting-elements-directly`.
13. **LilyPond v2.24 published docs** — `lilypond.org/doc/v2.24/Documentation/notation/displaying-staves` ·
    `…/Documentation/internals/spanbar`.

**Specs (all accessed 2026-08-28):**

14. **MusicXML 4.0** — `https://www.w3.org/2021/06/musicxml40/musicxml-reference/` :
    `elements/group-barline/` · `elements/part-group/` · `elements/part-symbol/` · `elements/barline/` ·
    `data-types/group-barline-value/`.
15. **MEI v5** — `https://music-encoding.org/guidelines/v5/` :
    `attribute-classes/att.staffGrp.vis.html` · `content/cmn.html` · `content/shared.html` §2.2.1.
    And **MEI v3** for the older spelling: `guidelines/v3/content/cmn.html`.

**SECONDARY (forums / issue trackers — labelled as such wherever cited):**

16. Scoring Notes (Philip Rothman), *"Fake it 'til you make it: New Sibelius plug-in for per-staff
    barline"*, 2017-01-31 —
    `https://www.scoringnotes.com/tips/fake-it-til-you-make-it-new-sibelius-plug-in-for-per-staff-barline/`
    and `https://www.scoringnotes.com/tips/barline-joins-in-sibelius/`.
17. Steinberg forums, *"Barlines only on staves"*, thread 930262, 2024-08-28 —
    `https://forums.steinberg.net/t/barlines-only-on-staves/930262`. ⚠️ Two claims taken from it
    (Alt+drag in Engrave mode; the "Barline joins" option group name) are **uncorroborated** by any
    manual page.
18. MuseScore issue **#15006**, *"[MU4 Issue] Grand staff barlines not connected when inserted in score
    w/ multiple instruments"*, 2022-12-07 — `https://github.com/musescore/MuseScore/issues/15006`.
19. MuseScore node 287614, *"Customized barline spans not always overridden when extending staff
    barline span"* — `https://musescore.org/en/node/287614`.

**Our own repo (context, read 2026-08-28):**

20. `src/types/music.ts:2018–2029` (`BarlineStatement`, incl. `staffId?`), `:2205–2216`
    (`Measure.barline` / `repeatStart` / `repeatEnd`), `:2256–2264` (`StaffGroup`), `:2307`
    (`Score.staffGroups`); `src/engine/layout/barlineSign.ts` (header);
    `src/engine/rendering/staff/BarlineRenderer.ts` (header, `:311–330`, `:442–470`);
    `src/engine/rendering/ScoreRenderer.ts:4022–4041, 4360–4389` (`drawSystemConnector`);
    `src/interactions/elements/barline.ts`; `docs/plans/barline-types-plan.md` §0.1, §2, §3.1, §4.5;
    `docs/plans/multi-staff-plan.md` §11.

---

## 9. ⛔ The complete UNKNOWN list

Nothing below was guessed at, and nothing below should be filled in by inference.

**Applications**
1. **Sibelius, organ default.** The guide gives the *brace* rule (*"an organ pedal staff is not braced
   to the organ manuals"*, p. 398) and never the *barline join* for organ.
2. **Sibelius internal storage** — whether the join is stored per staff or per staff-pair. Not
   documented; only the behaviour (*"affects every system simultaneously"*) is sourced.
3. **Sibelius 2023–2025.** Only 2022.3 was read. Whether a later release added mid-score joins: unknown.
4. **Dorico, the exact option labels** on Engraving Options ▸ Barlines for vocal/ossia staves. Steinberg
   does not enumerate individual engraving options; the forum's *"Barline joins"* is SECONDARY.
5. **Dorico, the v4 URL** for *Showing barlines across all staves at time signature changes* — the quote
   is from the **v1** page.
6. **Dorico, organ default** (two staves or three, braced or bracketed): no source found.
7. **Dorico ≥5/6 wording** — v5 archive bodies are stubs, ≥6 unreachable (as `reference/README.md`
   already records). Everything is Dorico 4.
8. **Finale, per-ensemble defaults** (piano / SATB / organ / orchestral sections). Not stated anywhere
   in the manual; settled by template files not inspected.
9. **Finale 26/27 wording** — the current manual trees 403; quotes are from the 2014 Win / 2012 Mac
   trees, which were internally consistent across the versions sampled.
10. **MuseScore, `instruments.xml` actual values** for piano / organ / voice. The 786 KB file could not
    be fetched by any route; the *reader* code is quoted verbatim, the *data* is not.
11. ~~**MuseScore, the `.mscx` tag spellings.**~~ ✅ **CLOSED** — read first-hand afterwards from the local
    checkout. On a `<BarLine>` element the tags are **`<span>`** (bool), **`<spanFromOffset>`** and
    **`<spanToOffset>`** (`src/engraving/rw/read460/tread.cpp:2038–2043`; write side
    `rw/write/twrite.cpp:775` — `xml.tag("span", item->span())`). On a `<Staff>` the tag is
    **`<barLineSpan>`** (`tread.cpp:4114`; the legacy 1.14 reader stored it as a *count* and converts,
    `read114/read114.cpp:2410–2416`). ⚠️ Still unverified: the write-side tag names for the *staff*
    fields.
12. **MuseScore 3 vs 4 diff.** `musescore.org/en/handbook/3/barlines` returned **403**. What is
    confirmed is that MU4's own current handbook still documents dragging.
13. **MuseScore, when the span handle is visible** — plain selection or Edit mode only. Not stated.
14. **MuseScore `Ctrl+drag` / double-click barline-span editing** as a *documented* gesture: no source
    in the MU4 handbook. ⭐ Note the **code** does implement a Ctrl distinction (`ed.control()` →
    `local`), so the modifier is real; it is the *documentation* that is missing.

**Formats**
15. **MusicXML, per-value gloss** of `group-barline-value`. One sentence covers the whole type; the
    individual values are not glossed in fetchable prose.
16. **MusicXML, an override for the `<part-symbol>` "by default" barline rule.** The spec says *"by
    default"*, implying one exists, and names none.
17. **MusicXML, whether any engine honours a mid-score `<part-symbol>` redeclaration.** The schema
    permits it; no fixture or engine code exercising it was found.
18. **MEI, the `scoreDef` placement bullet list** (ODD :5596–5601) — verified in the on-disk **6.0-dev**
    ODD only; the v5 page fetch was partial. The surrounding *milestone* rule **is** v5-confirmed.
19. **MEI, whether `@symbol` and `@bar.thru` interact.** No sentence asserts independence; orthogonality
    is a structural inference.
20. **LilyPond, the `measure-length` / `\remove "Bar_engraver"` Mensurstrich idiom** — not a documented
    recipe anywhere in the 2026 tree. Whether it survives as a legacy LSR snippet was not checked.
21. **LilyPond, `\override StaffGroup.SpanBar.stencil = ##f`** — not documented (only `.color` and
    `.glyph-name` appear in regressions). Plausible, unsourced.
22. **LilyPond v2.24 `PianoStaff` wording** — the dev tree says *"staves only removed together"*, the
    published v2.24 page says *"supports printing the instrument name directly"*. Both agree on
    barlines; the discrepancy is noted, not resolved.

**Treatises**
23. ⭐⭐ **MENSURSTRICH is absent from all four books we hold.** Gould, Ross, Stone and Gerou & Lusk have
    no section, rule or index entry for it (checked by grep across all four full texts — three hits,
    none about barlines). The only sourced definition in this survey is **LilyPond's**
    (`ancient.itely:3334–3340`, quoted in §3.5).
24. **What happens to REPEAT DOTS on a joined barline** — no treatise says. Already recorded in
    `docs/plans/barline-types-plan.md` §4.5 and re-confirmed here; the fact rests on three engines agreeing.
25. **Whether the four treatises would sanction a per-bar change of join.** They describe scores, not
    editing; none discusses varying the join mid-piece.

---

# PART 2 — MuseScore, read from the C++

# How MuseScore models, edits and draws a barline that spans two or more staves

**Source read:** `~/dev/engine-sources/MuseScore` at **`929d1e9`** ("Merge pull request #34619 from
Eism/issue_template_update_url"). Every claim below is quoted from that tree. Where a thing could not
be found in the code it is marked **UNKNOWN** rather than filled in from a manual.

Appendix engines: LilyPond `beedbfa`, Verovio `efff0bc` (same directory).

---

## 0. The one-paragraph answer

**The span is a property of the STAFF, and every barline instance carries a per-instance COPY of it
that layout keeps in sync.** `Staff::m_barLineSpan` is a `bool` meaning "join *my* line to the next
staff's". `BarLine::m_spanStaff` is the same bool on the drawn item; it is *seeded* from the staff by
layout every time a generated barline is created or refreshed, and it is the value actually read when
computing the line's y-extent. Neither is a property of the staff GROUP or of the bracket — the
bracket and the barline span are two independent fields that instrument templates happen to set
together. There is **no** span-bar object: **every staff always owns its own `BarLine` item at every
barline segment**, and "joining" means the upper staff's item is drawn *longer*, down to the top line
of the next visible staff, where the next staff's own item takes over. The ink is contiguous because
the two items abut, not because one item covers both staves.

---

## A. THE MODEL

### A.1 The two homes of the span

**`Staff`** — `src/engraving/dom/staff.h:273-275`:

```cpp
    bool m_barLineSpan = false;          // true - span barline to next staff
    int m_barLineFrom = 0;              // line of start staff to draw the barline from (0 = staff top line, ...)
    int m_barLineTo = 0;                // line of end staff to draw the bar line to (0= staff bottom line, ...)
```

accessors at `src/engraving/dom/staff.h:131-136` (`barLineSpan()/barLineFrom()/barLineTo()` +
setters).

**`BarLine`** — `src/engraving/dom/barline.h:178-180`:

```cpp
    bool m_spanStaff = false;         // span barline to next staff if true
    int m_spanFrom = 0;          // line number on start and end staves
    int m_spanTo = 0;
```

accessors at `src/engraving/dom/barline.h:106-112`.

### A.2 Which is authoritative? — **the Staff is the default, the BarLine is the truth used to draw**

The relationship is *default vs. override*, expressed through the property system:

`src/engraving/dom/barline.cpp:899-908` — a BarLine's property **default** is a live read of its staff:

```cpp
    case Pid::BARLINE_SPAN:
        return staff() ? staff()->barLineSpan() : false;

    case Pid::BARLINE_SPAN_FROM:
        return staff() ? staff()->barLineFrom() : 0;

    case Pid::BARLINE_SPAN_TO:
        return staff() ? staff()->barLineTo() : 0;
```

(Directly above, at `barline.cpp:895-898`, sits a comment warning that dynamic defaults are a bad
idea because a value equal to the default is omitted on write — a caveat the span fields then ignore.)

Layout copies staff → item for every **generated** barline. `MeasureLayout::barLinesSetSpan`,
`src/engraving/rendering/score/measurelayout.cpp:775-798`:

```cpp
void MeasureLayout::barLinesSetSpan(Segment* seg, LayoutContext& ctx)
{
    int track = 0;
    for (Staff* staff : ctx.dom().staves()) {
        BarLine* bl = toBarLine(seg->element(track));      // get existing bar line for this staff, if any
        if (bl) {
            if (bl->generated()) {
                bl->setSpanStaff(staff->barLineSpan());
                bl->setSpanFrom(staff->barLineFrom());
                bl->setSpanTo(staff->barLineTo());
            }
        } else {
            bl = Factory::createBarLine(seg);
            ...
            bl->setGenerated(true);
            bl->setSpanStaff(staff->barLineSpan());
            bl->setSpanFrom(staff->barLineFrom());
            bl->setSpanTo(staff->barLineTo());
            TLayout::layoutBarLine(bl, bl->mutldata(), ctx);
            ctx.mutDom().addElement(bl);
        }
        track += VOICES;
    }
}
```

and the same seeding for end barlines in `MeasureLayout::createEndBarLines`,
`src/engraving/rendering/score/measurelayout.cpp:920-947`:

```cpp
        for (staff_idx_t staffIdx = 0; staffIdx < nstaves; ++staffIdx) {
            track_idx_t track = staffIdx * VOICES;
            BarLine* barLine  = toBarLine(barlineSeg->element(track));
            const Staff* staff = ctx.dom().staff(staffIdx);
            if (!barLine) {
                barLine = Factory::createBarLine(barlineSeg);
                ...
                barLine->setGenerated(true);
                barLine->setSpanStaff(staff->barLineSpan());
                barLine->setSpanFrom(staff->barLineFrom());
                barLine->setSpanTo(staff->barLineTo());
                ...
            } else {
                // do not change bar line type if bar line is user modified
                // and its not a repeat start/end barline (forced)
                if (barLine->generated()) {
                    barLine->setSpanStaff(staff->barLineSpan());
                    barLine->setSpanFrom(staff->barLineFrom());
                    barLine->setSpanTo(staff->barLineTo());
                    barLine->setBarLineType(blType);
                }
                ...
```

⭐ **The `generated()` flag is the whole override mechanism.** A barline that has never been touched
by the user is `generated == true` and is re-seeded from its staff on every layout — it has no
independent span. The moment any property is set on it (`BarLine::setProperty` ends with
`setGenerated(false)`, `src/engraving/dom/barline.cpp:838`) it becomes a **local override** and layout
stops overwriting it.

The one place the staff reaches back into non-generated items is
`Staff::setProperty(Pid::STAFF_BARLINE_SPAN)`, `src/engraving/dom/staff.cpp:1514-1537`:

```cpp
    case Pid::STAFF_BARLINE_SPAN: {
        setBarLineSpan(v.toBool());
        // update non-generated barlines
        track_idx_t track = idx() * VOICES;
        std::vector<EngravingItem*> blList;
        for (Measure* m = score()->firstMeasure(); m; m = m->nextMeasure()) {
            Segment* s = m->getSegmentR(SegmentType::EndBarLine, m->ticks());
            if (s && s->element(track)) { blList.push_back(s->element(track)); }
            if (Measure* mm = m->mmRest()) { ... }
        }
        for (EngravingItem* e : blList) {
            if (e && e->isBarLine() && !e->generated()) {
                toBarLine(e)->setSpanStaff(barLineSpan());
            }
        }
    }
```

So setting the *staff* span is not a field write — it walks every measure (and every mmRest) of the
score and force-syncs `m_spanStaff` on the non-generated barlines of that staff too, i.e. **it wipes
out per-barline span overrides on that staff.** Note `SPAN_FROM`/`SPAN_TO` get no such propagation
(`staff.cpp:1538-1543` are plain setters).

Who reads which:
- **Drawing / y-extent:** `BarLine::m_spanStaff` (via `BarLine::calcY`, `src/engraving/dom/barline.cpp:230`).
- **Seeding a new barline:** `Staff::barLineSpan()` — `measurelayout.cpp:782,791,929,939`,
  `src/engraving/dom/measure.cpp:1298`, `src/engraving/editing/edit.cpp:3581`,
  `src/importexport/musicxml/internal/import/importmusicxmlpass2.cpp:2118`,
  `src/notationscene/qml/MuseScore/NotationScene/continuouspanel.cpp:349-351`.
- **Deciding whether an edit is local or global:** *both*, compared —
  `src/engraving/dom/barline.cpp:579` and `:675` (see §B).
- **Unrelated layout consumers of the staff flag:** `dynamicslayout.cpp:192`,
  `measurenumberlayout.cpp:208`.

### A.3 Is it per-barline, per-staff, or per-group? — **per-staff, with a per-instance override**

- **Not per-group.** `ScoreGroup` (`src/engraving/dom/scoreorder.h:40-51`) has a `bool barLineSpan = true`,
  but that is a *template* consulted once when instruments are added; it is immediately flattened onto
  individual staves and never read again at layout time.
- **Not per-bracket.** Brackets are separate objects (`BracketItem`, `Score::brackets(staffIdx)`), set
  side by side with the span in `Staff::init` (`staff.cpp:1150-1154`) and in the same instruments.xml
  entry — but nothing in `BarLine::calcY` or the layout passes consults a bracket. A piano's
  `<bracket type="1" span="2"/>` and its `<barLineSpan>1</barLineSpan>` are two independent facts
  (see the real file in §D.4).
- **Per-staff**, with the exception that any individual `BarLine` item can be de-generated and hold a
  different value. Both levels are `bool`-per-staff, so a run of joined staves is expressed as a
  *chain*: staff 0 spans, staff 1 spans, staff 2 does not → one line from staff 0 to staff 3's top.
  This chain-walk is what `nextVisibleSpannedStaff`/`prevVisibleSpannedStaff` follow
  (`src/engraving/dom/barline.cpp:170-224`).

### A.4 Where defaults come from

1. **`instruments.xml` → `InstrumentTemplate::barlineSpan`.**
   `share/instruments/instruments.xml:12662-12674` (Piano):
   ```xml
   <staves>2</staves>
   <clef>G</clef>
   <bracket>1</bracket>
   <bracketSpan>2</bracketSpan>
   <barlineSpan>2</barlineSpan>
   <clef staff="2">F</clef>
   ```
   In instruments.xml the tag is spelled `barlineSpan` (lowercase L) and is still an **int count of
   staves**. Conversion to the per-staff bool array, `src/engraving/dom/instrtemplate.cpp:474-479`:
   ```cpp
        } else if (tag == "barlineSpan") {
            int idx = readStaffIdx(e);
            int span = e.readInt();
            for (int i = 0; i < span - 1; ++i) {
                barlineSpan[idx + i] = true;
            }
   ```
   So `<barlineSpan>2</barlineSpan>` sets `barlineSpan[0] = true` only; `<barlineSpan>1</barlineSpan>`
   (hundreds of single-staff entries) sets nothing. Storage:
   `std::array<bool, MAX_STAVES> barlineSpan{};` — `src/engraving/dom/instrtemplate.h:120`.

2. **`Staff::init(const InstrumentTemplate*, ...)`** — the primary assignment,
   `src/engraving/dom/staff.cpp:1148-1155`:
   ```cpp
        stt->setSmall(t->smallStaff[templateStaffIdx]);
        EditStaffBrackets::setBracketType(score(), staffIdx, 0, t->bracket[templateStaffIdx]);
        EditStaffBrackets::setBracketSpan(score(), staffIdx, 0, t->bracketSpan[templateStaffIdx]);
        setBarLineSpan(t->barlineSpan[templateStaffIdx]);
   ```
   ⚠️ The copy-init overload `Staff::init(const Staff* s)` (`staff.cpp:1163-1186`) copies
   `m_barLineFrom` and `m_barLineTo` but **not `m_barLineSpan`** — a cloned staff starts unjoined and
   relies on `setBracketsAndBarlines()`/`remapBracketsAndBarlines()`.

3. **Between instruments: the score ORDER.** `ScoreOrder::setBracketsAndBarlines(Score*)`,
   `src/engraving/dom/scoreorder.cpp:382`. Two mechanisms:
   - within a multi-staff part, from the template (`scoreorder.cpp:413-438`, note the reset
     `staff->undoChangeProperty(Pid::STAFF_BARLINE_SPAN, false)` at :427 before re-setting);
   - between consecutive single-staff instruments, from the `ScoreGroup`
     (`scoreorder.cpp:476-485`):
     ```cpp
                 if (prvStaff) {
                     const bool newBarlineSpan = prvBarLineSpan && (!prvSection.isEmpty() && (sg.section == prvSection));
                     prvStaff->undoChangeProperty(Pid::STAFF_BARLINE_SPAN, newBarlineSpan);
                 }
     ```
     i.e. the previous staff joins to this one only if the previous group allowed spanning **and** both
     are in the same non-empty section. That is what makes all the woodwinds share a barline while the
     last woodwind does not join the first brass.
   - The section flag comes from `orders.xml`, e.g. `share/instruments/orders.xml:40`:
     `<section id="voices" barLineSpan="false">` — read at `scoreorder.cpp:148-175`, default `true`.
     `ScoreOrder::newUnsortedGroup` sets it `false` (`scoreorder.cpp:250-260`).
   - Entry point: `Score::setBracketsAndBarlines()` — `src/engraving/dom/score.cpp:3518`.

4. **Parts/excerpts:** `Score::remapBracketsAndBarlines()`, `src/engraving/dom/score.cpp:3530`
   (doc at :3524-3527), barline half at `:3585-3606` — because a part holds a subset of the master's
   staves, the run of joined master staves is walked forward until a staff that also exists in this
   excerpt is found, and only then is the span re-established, bridging the omitted staves.

5. **Adding a staff to an existing part:** `Score::updateBracesAndBarlines(Part*, size_t)`,
   `src/engraving/dom/score.cpp:3472`, `:3488-3509` — a new staff copies its neighbour's span, and
   going 1 → 2 staves re-consults the instrument template.

6. **Importers each derive it themselves**, bypassing templates — MusicXML
   `importmusicxmlpass1.cpp:1459,1496`, MEI `meiimporter.cpp:1332`, GuitarPro `gpconverter.cpp:1098`,
   Capella `capella.cpp:1258-1279`, MIDI `importmidi_instrument.cpp:660-663`, MNX
   `mnximporter.cpp:521-542`, Overture `importove.cpp:437-448`.

### A.5 What `spanFrom` / `spanTo` are measured in

**Half staff-line distances ("half-spaces"), i.e. the same units as VexFlow's line numbers × 2.**
`BarLine::calcY`, `src/engraving/dom/barline.cpp:264-273`:

```cpp
    double spatium1 = staffType1->spatium();
    double lineDistance = staffType1->lineDistance().val() * spatium1;
    double offset = staffType1->yoffset().val() * spatium1;
    double lineWidth = style().styleS(Sid::staffLineWidth).val() * spatium1 * .5;

    double y1 = offset + from * lineDistance * .5 - lineWidth;
    double y2 = offset + (staffType1->lines() * 2 - 2 + to) * lineDistance * .5 + lineWidth;
```

- `from = 0` → the staff's **top line**; `from` counts downward in half line-distances
  (`from = 2` = one line down).
- `to = 0`, **non-spanning** → the staff's **bottom line** (`lines*2 - 2` half-distances below the top
  line); `to` counts **downward** from there.
- `to = 0`, **spanning** → a different origin entirely, `barline.cpp:275-291`:

```cpp
    if (spanStaff) {
        // we need spatium and line distance of bottom staff
        // as it may be scalled diferently
        const Staff* staff2 = score()->staff(staffIdx2);
        const StaffType* staffType2 = staff2 ? staff2->staffType(tick) : staffType1;
        double spatium2 = staffType2->spatium();
        double lineDistance2 = staffType2->lineDistance().val() * spatium2;
        double startStaffY = system->staff(staffIdx1)->y();

        y2 = measure->staffLines(staffIdx2)->y1() - startStaffY - to * lineDistance2 * 0.5;

        // if bottom staff is single line, set span-to zeropoint to the top of the standard barline
        if (staffType2->lines() <= 1) {
            y2 += BARLINE_SPAN_1LINESTAFF_FROM * lineDistance2 * 0.5;
        }
    }
```

`StaffLines::y1()` is the y of that staff's **top line** in system coordinates
(`src/engraving/dom/stafflines.cpp:110-116`: `system->staff(staffIdx())->y() + ldata()->pos().y()`).

⭐ So the semantics of `spanTo` **flip with `spanStaff`**: non-spanning it is measured downward from
this staff's bottom line; spanning it is measured **upward from the next visible staff's top line**.
The header comment at `staff.h:275` ("0 = staff bottom line") describes the non-spanning case only and
is stale for the spanning one. This is exactly why a plain grand-staff barline (`spanStaff=true`,
`from=0`, `to=0`) reaches **only to the top line of the lower staff** — the lower staff's own barline
draws the rest.

**The preset special values** — `src/engraving/dom/barline.h:34-49`:

```cpp
static constexpr int MIN_BARLINE_FROMTO_DIST        = 2;
static constexpr int MIN_BARLINE_SPAN_FROMTO        = -2;

// bar line span for 1-line staves is special: goes from 2sp above the line to 2sp below the line;
static constexpr int BARLINE_SPAN_1LINESTAFF_FROM   = -4;
static constexpr int BARLINE_SPAN_1LINESTAFF_TO     = 4;

// data for some preset bar line span types
static constexpr int BARLINE_SPAN_TICK1_FROM        = -1;
static constexpr int BARLINE_SPAN_TICK1_TO          = -7;
static constexpr int BARLINE_SPAN_TICK2_FROM        = -2;
static constexpr int BARLINE_SPAN_TICK2_TO          = -6;
static constexpr int BARLINE_SPAN_SHORT1_FROM       = 2;
static constexpr int BARLINE_SPAN_SHORT1_TO         = -2;
static constexpr int BARLINE_SPAN_SHORT2_FROM       = 1;
static constexpr int BARLINE_SPAN_SHORT2_TO         = -1;
```

`MIN_BARLINE_FROMTO_DIST` and `MIN_BARLINE_SPAN_FROMTO` are **declared and never used anywhere in the
tree** (grep across `src/` finds only the declarations) — dead MU3-inspector clamps.

The 1-line-staff rule is applied in `calcY`, `barline.cpp:258-265`:
```cpp
    bool oneLine = staffType1->lines() <= 1;
    ...
    if (oneLine && m_spanFrom == 0 && m_spanTo == 0) {
        from = BARLINE_SPAN_1LINESTAFF_FROM;
        if (!spanStaff) {
            to = BARLINE_SPAN_1LINESTAFF_TO;
        }
    }
```

### A.6 Mensurstrich

There is **no Mensurstrich flag anywhere in the engraving DOM** — grep finds it only in the MusicXML
schema, the MNX importer/exporter and MNX test data. It is expressed *purely* through
`spanStaff` + `spanFrom` + `spanTo`. The MNX importer is the clearest statement of the encoding,
`src/importexport/mnx/internal/import/mnximporter.cpp:67-76`:

```cpp
int mensurStricheSpanFrom(int lines)
{
    return lines == 0 ? BARLINE_SPAN_1LINESTAFF_TO : 2 * lines;
}

int mensurStricheFinalSpanTo(int lines)
{
    // For 1-line staves, spanTo=0 triggers special full-height rendering.
    // Use matching from/to to collapse the final mensurstrich barline to zero height.
    return lines == 0 ? BARLINE_SPAN_1LINESTAFF_TO : 0;
}
```

applied at `mnximporter.cpp:517-547`:

```cpp
        Staff* staff = m_score->staff(idx);
        if (localSpan || mensurStriche) {
            staff->setBarLineSpan(true);
            staff->setBarLineTo(0);
            if (mensurStriche) {
                const int lines = staff->lines(Fraction(0, 1)) - 1;
                staff->setBarLineFrom(mensurStricheSpanFrom(lines));
            } else {
                staff->setBarLineFrom(0);
            }
        } else { ... }
    // Hide trailing barline segment on final staff of standalone mensurstrich groups.
        Staff* finalStaff = m_score->staff(overrideSpan.endStaff);
        if (!finalStaff->barLineSpan()) {
            const int lines = finalStaff->lines(Fraction(0, 1)) - 1;
            finalStaff->setBarLineFrom(mensurStricheSpanFrom(lines));
            finalStaff->setBarLineTo(mensurStricheFinalSpanTo(lines));
        }
```

Read against §A.5: `from = 2*(lines-1)` = this staff's **bottom** line, `to = 0` + spanning = the next
staff's **top** line ⇒ ink only in the gap. The last staff of the group is non-spanning with
`from = bottom line`, `to = 0` ⇒ `y1 == y2` ⇒ **zero-height, invisible**. That is the whole
Mensurstrich implementation.

The other "special value" tick barlines: `tickSpanFrom/tickSpanTo`, `mnximporter.cpp:57-65`.

---

## B. THE USER ACTION

### B.1 Selecting a barline puts it straight into edit mode with ONE grip

`src/engraving/dom/barline.h:152-157`:

```cpp
    void setSelected(bool f) override;
    bool needStartEditingAfterSelecting() const override { return true; }
    int gripsCount() const override { return 1; }
    Grip initialEditModeGrip() const override { return Grip::START; }
    Grip defaultGrip() const override { return Grip::START; }
    std::vector<PointF> gripsPositions(const EditData&) const override;
```

⭐ `needStartEditingAfterSelecting() == true` — **a single click on a barline arms the drag handle**;
there is no separate "enter edit mode" step. The one grip sits at the **bottom** end of the line
(the commented-out first entry shows a top grip once existed), `src/engraving/dom/barline.cpp:531-544`:

```cpp
std::vector<PointF> BarLine::gripsPositions(const EditData& ed) const
{
    const BarLineEditData* bed = static_cast<const BarLineEditData*>(ed.getData(this).get());

    double lw = style().styleAbsolute(Sid::barWidth) * staff()->staffMag(tick());
    const_cast<BarLine*>(this)->calcY();

    const PointF pp = pagePos();

    return {
        //PointF(lw * .5, y1 + bed->yoff1) + pp,
        PointF(lw * .5, ldata()->y2 + bed->yoff2) + pp
    };
}
```

`BarLine::startEdit` only allocates the scratch offsets, `barline.cpp:558-566`:

```cpp
void BarLine::startEdit(EditData& ed)
{
    std::shared_ptr<BarLineEditData> bed = std::make_shared<BarLineEditData>();
    bed->e     = this;
    bed->yoff1 = 0;
    bed->yoff2 = 0;
    ed.addData(bed);
}
```
(`BarLineEditData` is `{ double yoff1, yoff2; }` — `src/engraving/dom/barline.h:64-71`.)

### B.2 During the drag: nothing but a scratch offset, clamped

`BarLine::dragGrip`, `src/engraving/dom/barline.cpp:598-625`:

```cpp
void BarLine::dragGrip(EditData& ed)
{
    IF_ASSERT_FAILED(ed.curGrip == Grip::START) { return; }
    BarLineEditData* bed = static_cast<BarLineEditData*>(ed.getData(this).get());

    double lineDist = staff()->lineDistance(tick()) * spatium();
    calcY();

    // min for bottom grip is 1 line below top grip
    const double min = ldata()->y1 - ldata()->y2 + lineDist;
    // max is the bottom of the system
    const System* system = segment() ? segment()->system() : nullptr;
    const staff_idx_t st = staffIdx();
    const double max = (system && st != muse::nidx)
                       ? (system->height() - ldata()->y2 - system->staff(st)->y())
                       : std::numeric_limits<double>::max();
    // update yoff2 and bring it within limit
    bed->yoff2 += ed.delta.y();
    if (bed->yoff2 < min) { bed->yoff2 = min; }
    if (bed->yoff2 > max) { bed->yoff2 = max; }
}
```

So during the drag **the model is untouched** — only `yoff2`, clamped to "at least one line below the
top grip" and "at most the bottom of the system". You cannot drag a barline past the last staff.

### B.3 On release: SNAP TO THE NEAREST STAFF, and write span

`BarLine::endDragGrip`, `src/engraving/dom/barline.cpp:632-712`. The snap:

```cpp
    double ay0      = pagePos().y();
    double ay2      = ay0 + mutldata()->y2;   // absolute (page-relative) bar line bottom coord
    staff_idx_t staffIdx1 = staffIdx();
    System* syst   = segment()->measure()->system();
    double systTopY = syst->pagePos().y();

    // determine new span value
    staff_idx_t staffIdx2;
    size_t numOfStaves = syst->staves().size();
    if (staffIdx1 + 1 >= numOfStaves) {
        // if initial staff is last staff, ending staff must be the same
        staffIdx2 = staffIdx1;
    } else {
        // if there are other staves after it, look for staff nearest to bar line bottom coord
        double staff1TopY = syst->staff(staffIdx1)->y() + systTopY;

        for (staffIdx2 = staffIdx1 + 1; staffIdx2 < numOfStaves; ++staffIdx2) {
            // compute 1st staff height, absolute top Y of 2nd staff and height of blank between the staves
            Staff* staff1      = score()->staff(staffIdx2 - 1);
            double staff1Hght    = staff1->staffHeight(tick());
            double staff2TopY    = systTopY + syst->staff(staffIdx2)->y();
            double blnkBtwnStaff = staff2TopY - staff1TopY - staff1Hght;
            // if bar line bottom coord is above than mid-way of blank between staves...
            if (ay2 < (staff1TopY + staff1Hght + blnkBtwnStaff * .5)) {
                break;                          // ...staff 1 is ending staff
            }
            // if bar line is below, advance to next staff
            staff1TopY = staff2TopY;
        }
        staffIdx2 -= 1;
    }
```

⭐ **Yes, it snaps**, and the snap point is the **midpoint of the gap between two staves**. The drop
is quantised to a whole staff index — the free-form `yoff2` is thrown away entirely
(`bed->yoff1 = bed->yoff2 = 0.0;` at `barline.cpp:710-711`), and `newSpanFrom`/`newSpanTo` are
hard-coded to 0 (`barline.cpp:670-671`). **A drag can only ever set `spanStaff` on a run of staves and
reset from/to to 0; it can never produce a fractional or line-level extent.** Line-level `spanFrom`/
`spanTo` is reachable only through the properties panel (§B.5).

### B.4 LOCAL vs GLOBAL — the crux

Both the keyboard and the drag route through the same predicate.

`BarLine::endDragGrip`, `src/engraving/dom/barline.cpp:675-708`:

```cpp
    bool localDrag = ed.control() || segment()->isBarLineType() || spanStaff() != score()->staff(staffIdx())->barLineSpan();
    if (localDrag) {
        Segment* s = segment();
        bool breakLast = staffIdx1 == staffIdx2;
        for (staff_idx_t staffIdx = staffIdx1; staffIdx < staffIdx2; ++staffIdx) {
            BarLine* b = toBarLine(s->element(staffIdx * VOICES));
            if (!b) {
                b = toBarLine(linkedClone());
                b->setSpanStaff(true);
                b->setTrack(staffIdx * VOICES);
                b->setParent(s);
                score()->undoAddElement(b);
            }
            breakLast = b->spanTo();
            b->undoChangeProperty(Pid::BARLINE_SPAN, true);
        }
        if (breakLast) {
            BarLine* b = toBarLine(s->element(staffIdx2 * VOICES));
            if (b) { b->undoChangeProperty(Pid::BARLINE_SPAN, false); }
        }
    } else {
        bool breakLast = staffIdx1 == staffIdx2;
        for (staff_idx_t staffIdx = staffIdx1; staffIdx < staffIdx2; ++staffIdx) {
            breakLast = score()->staff(staffIdx)->barLineSpan();
            score()->staff(staffIdx)->undoChangeProperty(Pid::STAFF_BARLINE_SPAN, true);
        }
        if (breakLast) {
            score()->staff(staffIdx2)->undoChangeProperty(Pid::STAFF_BARLINE_SPAN, false);
        }
        staff()->undoChangeProperty(Pid::STAFF_BARLINE_SPAN_FROM, newSpanFrom);
        staff()->undoChangeProperty(Pid::STAFF_BARLINE_SPAN_TO,   newSpanTo);
    }
```

`local` is true when **any** of:
1. **`Ctrl` is held** during the drag (`ed.control()`), or
2. the segment is a **mid-measure `SegmentType::BarLine`** (a barline added inside a bar from the
   palette — those are always local), or
3. **this barline already differs from its staff default** (it is already a local override, so keep it
   local).

Otherwise the change is written to the **Staff**.

⭐ **The answer to "does changing one barline's span affect the following barlines?":**

- **Default gesture (no Ctrl, on a normal end/start-repeat barline): YES — the whole staff changes,
  for the entire score.** `undoChangeProperty(Pid::STAFF_BARLINE_SPAN, …)` runs
  `Staff::setProperty` (`staff.cpp:1514`), which sets the field *and* force-syncs every
  non-generated barline of that staff in every measure and mmRest; every generated barline is
  re-seeded from the staff on the next layout (`measurelayout.cpp:782/791/929/939`). Every barline in
  that staff, before and after the one you dragged, becomes joined.
- **With Ctrl held (or on a mid-measure barline, or on one that is already an override): NO — only
  that one barline instance at that one segment.** `b->undoChangeProperty(Pid::BARLINE_SPAN, true)`
  on the item, plus a `linkedClone()` inserted for any intermediate staff that has no barline at that
  segment.

Note the multi-staff drag: the loop sets span **true** on every staff from the origin down to
`staffIdx2 - 1`, and then `breakLast` clears it on `staffIdx2` so the chain terminates there — that is
how dragging across three staves produces one line and not a run-on.

### B.5 The keyboard gesture — ↑ / ↓ in edit mode

`src/engraving/dom/barline.h:116-117` + `src/engraving/dom/barline.cpp:567-593`:

```cpp
bool BarLine::isEditAllowed(EditData& ed) const
{
    return (ed.key == Key_Up && spanStaff()) || (ed.key == Key_Down && !spanStaff())
           || EngravingItem::isEditAllowed(ed);
}

bool BarLine::edit(EditData& ed)
{
    if (!isEditAllowed(ed)) { return false; }

    bool local = ed.control() || segment()->isBarLineType() || spanStaff() != score()->staff(staffIdx())->barLineSpan();
    if ((ed.key == Key_Up && spanStaff()) || (ed.key == Key_Down && !spanStaff())) {
        if (local) {
            BarLine* b = toBarLine(segment()->element(staffIdx() * VOICES));
            if (b) { b->undoChangeProperty(Pid::BARLINE_SPAN, !spanStaff()); }
        } else {
            score()->staff(staffIdx())->undoChangeProperty(Pid::STAFF_BARLINE_SPAN, !spanStaff());
        }
        return true;
    }
    return EngravingItem::edit(ed);
}
```

**↓ joins to the next staff, ↑ un-joins**, one staff at a time, with the identical local/global rule.
(Note this toggles one step only — it cannot chain across several staves the way a drag can.)

### B.6 The Properties panel route

`src/propertiespanel/qml/MuseScore/PropertiesPanel/notation/barlines/barlinesettingsmodel.cpp:60-63`:

```cpp
    m_isSpanToNextStaff = buildPropertyItem(Pid::BARLINE_SPAN);
    m_spanFrom = buildPropertyItem(Pid::BARLINE_SPAN_FROM);
    m_spanTo = buildPropertyItem(Pid::BARLINE_SPAN_TO);
```

UI labels, `.../barlines/BarlineSettings.qml`: **"Span to next staff"** checkbox (`:144`),
**"Span from"** (`:158`), **"Span to"** (`:177`), **"Set as staff default"** button (`:195`),
**"Span presets"** — Default / Tick 1 / Tick 2 / Short 1 / Short 2 (`:218-288`). The whole group is
behind a **"Show more"** disclosure (`:124`).

⭐ **These three write `Pid::BARLINE_SPAN*` — the ITEM's properties, never the staff's.** So the
properties panel is always the *local* route: it changes only the selected barline(s) and de-generates
them. Presets, `barlinesettingsmodel.cpp:190-219`:

```cpp
void BarlineSettingsModel::applySpanPreset(const int presetType)
{
    BarlineTypes::SpanPreset type = static_cast<BarlineTypes::SpanPreset>(presetType);
    switch (type) {
    case BarlineTypes::SpanPreset::PRESET_DEFAULT:
        m_isSpanToNextStaff->resetToDefault();
        m_spanFrom->resetToDefault();
        m_spanTo->resetToDefault();
        break;
    case BarlineTypes::SpanPreset::PRESET_TICK_1:
        m_isSpanToNextStaff->setValue(false);
        m_spanFrom->setValue(mu::engraving::BARLINE_SPAN_TICK1_FROM);
        m_spanTo->setValue(mu::engraving::BARLINE_SPAN_TICK1_TO);
        break;
    ...
```

"Default" is `resetToDefault()`, which — given `BarLine::propertyDefault` reads the staff (§A.2) —
means **"go back to whatever my staff says"**.

### B.7 "Apply to all" — the **"Set as staff default"** button

This is the affordance that promotes a local override to the staff.
`BarlineSettingsModel::setSpanIntervalAsStaffDefault`,
`src/propertiespanel/.../barlinesettingsmodel.cpp:221-256`:

```cpp
void BarlineSettingsModel::setSpanIntervalAsStaffDefault()
{
    undoStack()->prepareChanges(muse::TranslatableString("undoableAction", "Set barline span interval as staff default"));
    std::vector<mu::engraving::EngravingItem*> staves;
    auto undoChangeProperty = [](mu::engraving::EngravingObject* o, mu::engraving::Pid pid, const QVariant& val)
    { o->undoChangeProperty(pid, PropertyValue::fromQVariant(val, mu::engraving::propertyType(pid))); };

    for (mu::engraving::EngravingItem* item : m_elementList) {
        if (!item->isBarLine()) { continue; }
        mu::engraving::BarLine* barline = mu::engraving::toBarLine(item);
        mu::engraving::Staff* staff = barline->staff();

        if (std::find(staves.cbegin(), staves.cend(), staff) == staves.cend()) {
            undoChangeProperty(staff, mu::engraving::Pid::STAFF_BARLINE_SPAN, m_isSpanToNextStaff->value());
            undoChangeProperty(staff, mu::engraving::Pid::STAFF_BARLINE_SPAN_FROM, m_spanFrom->value());
            undoChangeProperty(staff, mu::engraving::Pid::STAFF_BARLINE_SPAN_TO, m_spanTo->value());
            staves.push_back(staff);
        }

        if (barline->barLineType() == mu::engraving::BarLineType::NORMAL) {
            barline->setGenerated(true);
        }
    }
    undoStack()->commitChanges();
    updateNotation();
}
```

It writes the three `STAFF_*` properties **and** re-marks a plain barline `generated` so that layout
resumes owning it. That, plus the force-sync inside `Staff::setProperty`, is the "apply to all
barlines in this staff" affordance. There is no "apply to all staves" button — you would select
barlines on several staves and press it once.

### B.8 Staff/Part properties dialog

**It does NOT expose barline span.** `src/notationscene/widgets/editstaff.ui` and `editstaff.cpp`
contain only `showBarlines` (a StaffType flag, `editstaff.cpp:439-441`) and `hideSystemBarLine`
(`editstaff.cpp:177,187,626`). Grepping `barLineSpan|BARLINE_SPAN` across `src/notation`,
`src/notationscene`, `src/instrumentsscene` finds only `instrumentsrepository.cpp:300`
(`templ->barlineSpan[0] = true;` when synthesising a template) and `continuouspanel.cpp:349-351`.
So in MU4 the *only* user routes are: the drag grip, ↑/↓, and the Properties panel.

### B.9 The undo commands

There is **no `ChangeBarLineSpan`, no `ChangeSingleBarLineSpan`, no `Score::cmdBarlineSpan`** in this
tree — grep finds nothing. All of it is the generic property machinery:

- `EngravingObject::undoChangeProperty(Pid, PropertyValue, PropertyFlags)` —
  `src/engraving/dom/engravingobject.cpp:453` → `changeProperties` (`:400`) → `changeProperty` →
  **`ChangeProperty`** (`src/engraving/editing/editproperty.h:30`), one per linked object.
- `BarLine::undoChangeProperty` (`src/engraving/dom/barline.cpp:847-858`) special-cases only
  `Pid::BARLINE_TYPE`; span falls straight through to the base.
- The Staff route is the same `ChangeProperty` on the `Staff` object (Staff has no
  `undoChangeProperty` override — `staff.h:210-212` overrides only get/set/default).
  `ChangeStaff` (`src/engraving/editing/editstaff.h:195`) exists but is used for the staff-type /
  visibility bundle, not for span.
- Tests drive it exactly this way — `src/engraving/tests/barline_tests.cpp:160-162`:
  ```cpp
    score->undo(new ChangeProperty(score->staff(0), Pid::STAFF_BARLINE_SPAN, true));
    score->undo(new ChangeProperty(score->staff(0), Pid::STAFF_BARLINE_SPAN_FROM, 2));
    score->undo(new ChangeProperty(score->staff(0), Pid::STAFF_BARLINE_SPAN_TO, -2));
  ```
  and the local form at `barline_tests.cpp:206-208`:
  ```cpp
    bar->undoChangeProperty(Pid::BARLINE_SPAN, true);
    bar->undoChangeProperty(Pid::BARLINE_SPAN_FROM, 2);
    bar->undoChangeProperty(Pid::BARLINE_SPAN_TO, 6);
  ```

---

## C. LAYOUT AND DRAWING

### C.1 THREE passes, and why the y-extent can only be computed last

A spanning barline's `y2` needs `system->staff(staffIdx2)->y()` and
`measure->staffLines(staffIdx2)->y1()` (`src/engraving/dom/barline.cpp:281,284`) — the *final* staff
positions. Those are not final until `SystemLayout::layout2` has distributed the staves **and**
`PageLayout::distributeStaves` has justified the page. But the staff distribution itself depends on
the skyline, which the barline contributes to. MuseScore breaks the circularity with a provisional
first pass.

**Pass 1 — `TLayout::layoutBarLine`** (`src/engraving/rendering/score/tlayout.cpp:1069`) fakes a
single 5-line staff, and says so, `tlayout.cpp:1111-1115`:

```cpp
    // Note: the true values of y1 and y2 are computed in layout2() (can be done only
    // after staff distances are known). This is a temporary layout.
    const double spatium = item->spatium();

    ldata->y1 = spatium * .5 * item->spanFrom();
    ldata->y2 = spatium * .5 * (8.0 + item->spanTo());
```

That is enough for the barline's *width* and the horizontal spacing. Bbox at `tlayout.cpp:1143`,
then `updateBarlineShape` at `:1145`.

**Pass 1b — `TLayout::updateBarlineShape`** (`tlayout.cpp:1188-1233`), the skyline shape, deliberately
clipped to one staff:

```cpp
    RectF bb = ldata->bbox();
    if (item->staff()) {
        // actual height may include span to next staff
        // but this should not be included in shapes or skylines
        double sp = item->spatium();
        int span = item->staff()->lines(item->tick()) - 1;
        int sFrom;
        int sTo;
        if (span == 0 && item->spanTo() == 0) {
            sFrom = BARLINE_SPAN_1LINESTAFF_FROM;
            sTo = item->spanStaff() ? 0 : BARLINE_SPAN_1LINESTAFF_TO;
        } else {
            sFrom = item->spanFrom();
            sTo = item->spanStaff() ? 0 : item->spanTo();
        }
        double y = sp * sFrom * 0.5;
        double h = sp * (span + (sTo - sFrom) * 0.5);
        ...
        bb.setTop(y);
        bb.setHeight(h);
    }
    ldata->setShape(Shape(bb, item));
```

⭐ **`sTo = item->spanStaff() ? 0 : item->spanTo()`** is the whole trick: if a spanning barline
contributed its real height to the skyline, it would push the next staff further away, which would
make it longer, which would push further… The skyline sees only the staff-local part. Re-run per
system at `src/engraving/rendering/score/systemlayout.cpp:1271-1275`, immediately before
`createSkylines`.

**Pass 2 — `TLayout::layoutBarLine2`** (`tlayout.cpp:1238`), banner comment at `:1234`
`// called after system layout; set vertical dimensions`:

```cpp
    if (ldata->isSkipDraw()) { return; }

    item->calcY();
    RectF bbox = ldata->bbox();
    bbox.setTop(ldata->y1);
    bbox.setBottom(ldata->y2);
    ... // repeatBarTips: unite bracketTop / bracketBottom at y1 / y2
    ldata->setBbox(bbox);            // tlayout.cpp:1280
```

`BarLine::calcY()` is called from **exactly one place in the rendering layer** — `tlayout.cpp:1248`
(the other callers are the edit paths, `dom/barline.cpp:536,607,634`) — and it refuses to run without
a system, `src/engraving/dom/barline.cpp:243-246`:

```cpp
    Measure* measure = segment()->measure();
    System* system = measure->system();
    if (!system) {
        return;
    }
```

**Call sites of `layoutBarLine2`:** `src/engraving/rendering/score/pagelayout.cpp:392` (page mode,
inside `PageLayout::collectPage`), `pagelayout.cpp:419` (re-layout of the *first barlines of the next
page*, because collecting the next page can move them), and
`src/engraving/rendering/score/scorehorizontalviewlayout.cpp:239` (continuous view).

The forced order in `collectPage`: collect systems → `SystemLayout::layout2`
(`systemlayout.cpp:2185`, comment *"called after measure layout / adjusts staff distance"*; sets each
`SysStaff` bbox at `:2297,2300`) → `PageLayout::distributeStaves` (`pagelayout.cpp:652`), which
**moves staves again** for vertical justification (`pagelayout.cpp:841`
`vgd->sysStaff->bbox().translate(0.0, staffShift);`) → only then the segment walk at
`pagelayout.cpp:306-400` calls `layoutBarLine2` (`:392`) and `MeasureLayout::layout2` (`:396`).

### C.2 The chain walk — which staff the line ends on, and hidden staves

`src/engraving/dom/barline.cpp:192-224`:

```cpp
static size_t nextVisibleSpannedStaff(const BarLine* bl)
{
    Score* score = bl->score();
    size_t nstaves = score->nstaves();
    size_t staffIdx = bl->staffIdx();
    Segment* segment = bl->segment();
    for (size_t i = staffIdx + 1; i < nstaves; ++i) {
        Staff* s = score->staff(i);
        if (s->part()->show()) {
            // span/show bar line if this measure is visible
            if (bl->measure()->visible(i)) {
                return i;
            }
            // or if this is an endBarLine and:
            if (segment && segment->isEndBarLineType()) {
                // ...this measure contains a (cutaway) courtesy clef only
                if (bl->measure()->isCutawayClef(i)) {
                    return i;
                }
                // ...or next measure is both visible and in the same system
                Measure* nm = bl->measure()->nextMeasure();
                if ((nm ? nm->visible(i) : false) && (nm ? nm->system() == bl->measure()->system() : false)) {
                    return i;
                }
            }
        }
        BarLine* nbl = toBarLine(segment->element(i * VOICES));
        if (!nbl || !nbl->spanStaff()) {
            break;
        }
    }
    return staffIdx;
}
```

⭐ **This is the hide-empty-staves handling.** The walk skips staves whose part is hidden or whose
measure is invisible, and keeps walking only while the skipped staff's *own* barline also spans. If no
visible staff is found below, it returns the origin index and the line does not span at all. The
mirror `prevVisibleSpannedStaff` (`barline.cpp:170-187`) answers "is anything spanning into me from
above". `BarLine::pagePos()` does the same skip for the *start* end (`barline.cpp:136-163`), so a
spanning barline whose top staff is hidden re-anchors to the first visible spanned staff.
`BarLine::isTop()` / `isBottom()` (`barline.cpp:341-366`) are these two walks turned into predicates.

Because `calcY` runs only in `layoutBarLine2`, long after hiding, the walk always sees the final
visibility state. Hiding itself is `SystemLayout::hideEmptyStaves`
(`src/engraving/rendering/score/systemlayout.cpp:725`, `ss->setShow(...)` at `:760,768`), and the
barlines are fixed by simply **re-running the layout**, `systemlayout.cpp:411-436`:

```cpp
    // Hide empty staves
    hideEmptyStaves(system, ctx, ctx.state().firstSystem());
    // Re-create shapes to account for newly hidden/unhidden staves
    ...
    // Relayout system to account for newly hidden/unhidden staves
    SystemLayout::layoutSystem(system, ctx, leadingHBoxesWidth);
    // Create end barlines and system trailer if needed (cautionary time/key signatures etc)
    Measure* lm  = system->lastMeasure();
    if (lm) {
        MeasureLayout::createEndBarLines(lm, true, ctx);
```

Invisible staves are also skipped when barlines are collected for layout
(`systemlayout.cpp:1470-1475`), when skylines are built (`:1688-1692`), in `layout2`
(`:2197-2206`), in `layoutSystem` (`:2151`) and in the mask pass (`masklayout.cpp:116`).

A staff whose barlines are switched off entirely gets `setIsSkipDraw(true)` at `tlayout.cpp:1079`
(from `StaffType::showBarlines() == false` or `Staff::hideSystemBarLine()`), and `layoutBarLine2`
returns early on it (`tlayout.cpp:1244`) — so such an item keeps an empty bbox and draws nothing,
while the visible-staff walk above bridges over it.

### C.3 The drawing — ONE line, y1 → y2, crossing the gap

`TDraw::draw(const BarLine*, …)`, `src/engraving/rendering/score/tdraw.cpp:715`, e.g. `:731-737`:

```cpp
    case BarLineType::NORMAL: {
        double lw = item->style().styleAbsolute(Sid::barWidth) * item->mag();
        painter->setPen(Pen(item->curColor(opt), lw, PenStyle::SolidLine, PenCapStyle::FlatCap));
        painter->drawLine(LineF(lw * .5, data->y1, lw * .5, data->y2));
    }
```

— and identically for BROKEN / DOTTED / END / DOUBLE / REVERSE_END / HEAVY / DOUBLE_HEAVY
(`tdraw.cpp:739-800`). **The span is not a separate stencil**; it is simply a longer `drawLine`.

⭐ **But the whole joined line is drawn by TWO OR MORE COOPERATING ITEMS, not by one.** `calcY` ends
the upper staff's line at the *top line* of the lower staff (`barline.cpp:284`), and the lower staff's
own `BarLine` item begins at its own top line and continues to its own bottom line. Each item paints
in its own staff-local coordinate system. The stroke looks continuous because the two abut. Contrast
LilyPond and Verovio, which both emit the gap as its own segment (Appendix).

**Repeat dots** are always staff-local, `tdraw.cpp:668-693`:

```cpp
        const StaffType* st = item->staffType();
        const int lines = st->lines();
        const double lineDistance = item->absoluteFromSpatium(st->lineDistance());
        y1l = (static_cast<double>((lines - 1) / 2) - 0.5) * lineDistance;
        y2l = (static_cast<double>(lines / 2) + 0.5) * lineDistance;
        //adjust for staffType offset
        double stYOffset = item->staffOffsetY();
```

computed from **this** staff's line count and line distance, never from the span — so a joined repeat
gets one pair of dots per staff, as convention requires.

**Repeat wings/tips** are the only span-aware part of the drawing, `tdraw.cpp:695-712`:

```cpp
static void drawTips(const BarLine* item, const BarLine::LayoutData* data, Painter* painter, bool reversed, double x)
{
    if (reversed) {
        if (item->isTop()) {
            item->drawSymbol(SymId::reversedBracketTop, painter, PointF(x - item->symWidth(SymId::reversedBracketTop), data->y1));
        }
        if (item->isBottom()) {
            item->drawSymbol(SymId::reversedBracketBottom, painter, PointF(x - item->symWidth(SymId::reversedBracketBottom), data->y2));
        }
    } else {
        if (item->isTop()) {
            item->drawSymbol(SymId::bracketTop, painter, PointF(x, data->y1));
        }
        if (item->isBottom()) {
            item->drawSymbol(SymId::bracketBottom, painter, PointF(x, data->y2));
        }
    }
}
```

⭐ **Tips only at the two ends of the whole joined run** — the middle staves of a grand staff get no
tips. Matching bbox/shape maths at `tlayout.cpp:1211` and `:1253-1275`, both guarded by
`Sid::repeatBarTips`. (This is precisely the rule our `BarlineRenderer` deliberately does not follow;
see §E.)

**Masking.** `TDraw::draw` calls `setMask(item, painter)` (`tdraw.cpp:729`); the mask is computed only
for spanning barlines, `MaskLayout::computeBarlineMasks`,
`src/engraving/rendering/score/masklayout.cpp:103`, `:115-124`:

```cpp
        BarLine* barline = toBarLine(barlineSement->element(staff2track(staffIdx)));
        if (!barline || !barline->spanStaff()) { continue; }
        maskBarlineForText(barline, allSystemText);
```

It uses `barline->shape()` (`masklayout.cpp:130`), which by then is the **full-span** rectangle because
`computeMasks` runs at `pagelayout.cpp:444`, *after* `layoutBarLine2` — that ordering is load-bearing.
This is the same job Verovio does with `eraseIntersections`.

Palette / single-item duplicate of the whole draw: `src/engraving/rendering/single/singledraw.cpp:693`.

### C.4 Different line counts, different staff scaling

`calcY` reads the geometry of **both** staves independently, `barline.cpp:275-291`:

```cpp
    if (spanStaff) {
        // we need spatium and line distance of bottom staff
        // as it may be scalled diferently
        const Staff* staff2 = score()->staff(staffIdx2);
        const StaffType* staffType2 = staff2 ? staff2->staffType(tick) : staffType1;
        double spatium2 = staffType2->spatium();
        double lineDistance2 = staffType2->lineDistance().val() * spatium2;
        double startStaffY = system->staff(staffIdx1)->y();

        y2 = measure->staffLines(staffIdx2)->y1() - startStaffY - to * lineDistance2 * 0.5;

        // if bottom staff is single line, set span-to zeropoint to the top of the standard barline
        if (staffType2->lines() <= 1) {
            y2 += BARLINE_SPAN_1LINESTAFF_FROM * lineDistance2 * 0.5;
        }
    }
```

1-line handling at both ends (`barline.cpp:258-265` top, `:286-289` bottom). A **stafftype change** in
the next measure of the same system is corrected at `barline.cpp:293-332` by taking `min(y1, y1Next)`
and (non-spanning only) `max(y2, y2Next)`, and only when `rtick().isNotZero()`.

**Small staves.** `Sid::scaleBarlines` (default **false** — a barline divides the system) decides
whether the item takes the staff's mag at all, `tlayout.cpp:1110`:

```cpp
    ldata->setMag(ctx.conf().styleB(Sid::scaleBarlines) && item->staff() ? item->staff()->staffMag(item->tick()) : 1.0);
```

Every `drawLine` multiplies its style width by `item->mag()`. ⚠️ The mag is taken from the **top**
staff of the span only, so a barline spanning from a normal staff into a small one keeps the top
staff's thickness for its own segment; the small staff's own item then uses its own mag.

`SystemLayout::layout2` sizes the `SysStaff` box specially for 1-line staves with the same constants,
`systemlayout.cpp:2231-2241`:

```cpp
        if (staff->lines(Fraction(0, 1)) == 1) {
            yOffset = _spatium * BARLINE_SPAN_1LINESTAFF_TO * 0.5;
            h = _spatium * (BARLINE_SPAN_1LINESTAFF_TO - BARLINE_SPAN_1LINESTAFF_FROM) * 0.5;
        } else {
            yOffset = 0.0;
            h = staff->staffHeight();
        }
```

### C.5 The system-opening barline — span is HARDCODED, and this is the only bracket coupling

`MeasureLayout::createSystemBeginBarLine`, `src/engraving/rendering/score/measurelayout.cpp:2058`,
called from `SystemLayout::layoutSystem` (`systemlayout.cpp:2174`) for the first measure of a system:

```cpp
    size_t n = 0;
    if (m->system()) {
        for (SysStaff* sysStaff : m->system()->staves()) {
            if (sysStaff->show()) { ++n; }
        }
    }
    if ((n > 1 && ctx.conf().styleB(Sid::startBarlineMultiple))
        || (n == 1 && (ctx.conf().styleB(Sid::startBarlineSingle) || m->system()->brackets().size()))) {
```

and, `measurelayout.cpp:2087`:

```cpp
                bl->setSpanStaff(true);
```

⭐ **The line that opens a system always spans every staff, regardless of `Staff::barLineSpan()`.**
Per-staff suppression is `Staff::hideSystemBarLine()` (`staff.h:123-124,278` — *"no system barline if
not preceded by staff with barline"*, exposed in Staff/Part properties as **"Hide system barline"**,
`editstaff.ui:1230-1232`), handled as `setIsSkipDraw(true)` at `tlayout.cpp:1074-1080`.

That `m->system()->brackets().size()` at `measurelayout.cpp:2071` is **the only place in the layout
where a bracket influences a barline**: a single-staff system still gets an opening line if it is
bracketed. Everywhere else the two are independent — bracket geometry comes from
`BracketItem::bracketSpan()` via `SystemHeaderLayout::createBracket`
(`src/engraving/rendering/score/systemheaderlayout.cpp:81`, `:90`
`staff_idx_t lastStaff = staffIdx + bi->bracketSpan() - 1;`) and
`SystemHeaderLayout::layoutBracketsVertical` (`:297`, reading `system->staves().at(staffIdx1)->bbox().top()`
and `...at(staffIdx2)->bbox().bottom()` at `:320-321` — the same "needs final staff y" dependency,
which is why it too is re-run after `distributeStaves`, `pagelayout.cpp:851`). No code path feeds
`bracketSpan` into `barLineSpan` at layout time; they are correlated only at score-construction time
(`ScoreOrder`, `Score::updateBracesAndBarlines`, `Score::remapBracketsAndBarlines`).

### C.6 Hit-testing a barline that spans staves

⚠️ **bbox and shape are the same storage**, and the second pass overwrites the first.
`src/engraving/dom/engravingitem.cpp:2813`:

```cpp
void EngravingItem::LayoutData::setBbox(const RectF& r)
{
    ...
    m_shape.set_value(Shape(r, m_item, Shape::Type::Fixed));
}
```

(`bbox()` just returns `sh.bbox()`, `engravingitem.cpp:2881`.) So the sequence is:

1. `updateBarlineShape` installs the **staff-clipped** shape (`tlayout.cpp:1186`);
2. skylines are built from it (`systemlayout.cpp:1271-1275`) — the staves get distributed without the
   span inflating anything;
3. `layoutBarLine2`'s `ldata->setBbox(bbox)` (`tlayout.cpp:1280`) **replaces** it with the
   **full-span** rectangle.

`BarLine` does **not** override `hitShape` (the only override in the tree is `StaffLines`,
`src/engraving/dom/stafflines.h:59`); the base is `engravingitem.h:275`
`virtual Shape hitShape() const { return shape(); }`. The hit path is
`NotationInteraction::hitElements` (`src/notation/internal/notationinteraction.cpp:733`) →
`page->items(hitRect)` (BSP tree, `src/engraving/dom/page.cpp:134`) →
`element->hitShapeContains(posOnPage)` (`notationinteraction.cpp:778`) →
`hitShape().contains(p - pagePos())` (`src/engraving/dom/engravingitem.cpp:952`).

⭐ **So a click in the gap between two staves DOES hit the spanning barline**, with no special-case
code anywhere in the notation layer — it falls out of the full-span rect plus `BarLine::pagePos()`
anchoring at the top visible spanned staff. Ranking among overlapping hits is the generic
`NotationInteraction::elementIsLess` (`notationinteraction.cpp:799`).

⚠️ The two shape writes are in tension by design. Anything that re-ran `updateBarlineShape` *after*
`layoutBarLine2` would silently shrink the selectable area back to one staff.

Barline-specific cases in the interaction layer (all editing, not hit-testing):
- `src/notation/internal/notationinteraction.cpp:1152` —
  `bool constrainDirection = !(isGripEditStarted() && m_editData.element && m_editData.element->isBarLine());`
  so the span grip can be dragged freely in Y;
- `notationinteraction.cpp:3331,3346` — `getHRaster()/getVRaster()` force a 0.25 sp raster
  (`hRaster = 4.0`, `vRaster = 4.0`) for barlines, which is how the grip quantises;
- drop/anchor special cases at `:2667, 2850, 2888, 2915`.

Navigation and "which barline covers this staff" is the chain walk again, `Segment::getElement`,
`src/engraving/dom/segment.cpp:1555-1573`:

```cpp
    } else if (segmentType() & (SegmentType::EndBarLine | SegmentType::BarLine | SegmentType::StartRepeatBarLine)) {
        for (int i = static_cast<int>(staff); i >= 0; i--) {
            if (!element(i * VOICES)) { continue; }
            BarLine* b = toBarLine(element(i * VOICES));
            if (i + b->spanStaff() >= static_cast<int>(staff)) {
                return element(i * VOICES);
            }
        }
    }
```

i.e. walk **upward** until you find a barline whose reach includes the requested staff.

### C.7 Two more span-aware passes

- **Horizontal spacing against lyrics** — a spanning barline must be spaced against chordrests on
  *both* staves. `HorizontalSpacing::spaceLyricsAgainstBarlines`,
  `src/engraving/rendering/score/horizontalspacing.cpp:546`, at `:571-580`:
  ```cpp
        BarLine* barline = toBarLine(barlineSegment->element(staff2track(staffIdx)));
        if (!barline || !barline->spanStaff()) { continue; }
        Shape barlineShape = barline->shape().translate(barline->pos());
        track_idx_t startTrack = staff2track(staffIdx);
        track_idx_t endTrack = staff2track(nextStaff) + VOICES;
  ```
- **Play-count text** dodges an incoming spanning barline from above —
  `TLayout::layoutPlayCountText`, `tlayout.cpp:4521-4524`.
- **Copy/paste** preserves span per barline — `src/engraving/dom/range.cpp:1121,1137`.

---

## D. SERIALIZATION

### D.1 What a `BarLine` writes

`src/engraving/rw/write/twrite.cpp:850-857`:

```cpp
void TWrite::write(const BarLine* item, XmlWriter& xml, WriteContext& ctx)
{
    xml.startElement(item);
    writeProperty(item, xml, Pid::BARLINE_TYPE);
    writeProperty(item, xml, Pid::BARLINE_SPAN);
    writeProperty(item, xml, Pid::BARLINE_SPAN_FROM);
    writeProperty(item, xml, Pid::BARLINE_SPAN_TO);
```

Tag names from the property table, `src/engraving/dom/property.cpp:103-105`:

| Pid | type | tag |
|---|---|---|
| `BARLINE_SPAN` | BOOL | `span` |
| `BARLINE_SPAN_FROM` | INT | `spanFromOffset` |
| `BARLINE_SPAN_TO` | INT | `spanToOffset` |

**Written only when different from the default** — `TWrite::writeProperty`,
`src/engraving/rw/write/twrite.cpp:401-412`, computes `d = item->propertyDefault(pid)` and
`xml.tagProperty(pid, p, d)` suppresses equal values. Since the BarLine's default *is* its staff's
value (§A.2), **`<span>` appears on a `<BarLine>` only when that barline is a local override.**

### D.2 What a `Staff` writes

`src/engraving/rw/write/twrite.cpp:2939-2941` (inside `TWrite::write(const Staff*)` at `:2888`):

```cpp
    writeProperty(item, xml, Pid::STAFF_BARLINE_SPAN);
    writeProperty(item, xml, Pid::STAFF_BARLINE_SPAN_FROM);
    writeProperty(item, xml, Pid::STAFF_BARLINE_SPAN_TO);
```

Tags `barLineSpan` / `barLineSpanFrom` / `barLineSpanTo` (`property.cpp:322-324`), defaults
`false / 0 / 0` (`staff.cpp:1597-1601`).

### D.3 Reading (current, read460)

`src/engraving/rw/read460/tread.cpp:2027-2041`:

```cpp
void TRead::read(BarLine* b, XmlReader& e, ReadContext& ctx)
{
    // initialize span properties with staff values
    b->resetProperty(Pid::BARLINE_SPAN);
    b->resetProperty(Pid::BARLINE_SPAN_FROM);
    b->resetProperty(Pid::BARLINE_SPAN_TO);

    while (e.readNextStartElement()) {
        const AsciiStringView tag(e.name());
        ...
        } else if (tag == "span") {
            b->setSpanStaff(e.readBool());
        } else if (tag == "spanFromOffset") {
            b->setSpanFrom(e.readInt());
        } else if (tag == "spanToOffset") {
            b->setSpanTo(e.readInt());
```

The three `resetProperty` calls are the exact reciprocal of the omit-if-default write.

Staff side, `src/engraving/rw/read460/tread.cpp:4114-4128`:

```cpp
    } else if (tag == "barLineSpan") {
        const int barLineSpan = e.readInt();
        if (barLineSpan < 0) {
            LOGW() << "barLineSpan is negative: " << barLineSpan;
            s->setBarLineSpan(false);
        } else if (barLineSpan > 1) {
            LOGW() << "barLineSpan is > 1: " << barLineSpan;
            s->setBarLineSpan(true);
        } else {
            s->setBarLineSpan(static_cast<bool>(barLineSpan));
        }
    } else if (tag == "barLineSpanFrom") {
        s->setBarLineFrom(e.readInt());
    } else if (tag == "barLineSpanTo") {
        s->setBarLineTo(e.readInt());
```

duplicated in read500 (`.../read500/tread.cpp:4231`), read410 (`:3959`), read400 (`:3851`).

### D.4 Real file fragments

Grand staff (the ordinary case) —
`src/notationscene/qml/MuseScore/NotationScene/tests/data/test.mscx:23-28`:

```xml
      <Staff id="1">
        <StaffType group="pitched">
          <name>stdNormal</name>
          </StaffType>
        <bracket type="1" span="2" col="2"/>
        <barLineSpan>1</barLineSpan>
        </Staff>
```

⭐ **That is the whole grand staff.** Staff 2 carries no `barLineSpan` at all, and no `<BarLine>`
element is written anywhere — every barline in the piece is generated at layout from these two facts.
Note the brace (`<bracket type="1" span="2">`) is a *separate*, independent tag.

Three joined flutes — `src/engraving/tests/barline_data/barline01.mscx:24-29`
(`<bracket type="0" span="3" col="0"/>` + `<barLineSpan>1</barLineSpan>`, repeated on staves 2 and 3).

A per-barline local override — `src/engraving/tests/barline_data/barline06.mscx:145-148`:

```xml
          <BarLine>
            <subtype>double</subtype>
            <span>1</span>
            </BarLine>
```

Span offsets — `src/engraving/tests/barline_data/barlinedelete-ref.mscx:178-182`:

```xml
          <BarLine>
            <spanFromOffset>2</spanFromOffset>
            <spanToOffset>-2</spanToOffset>
            <eid>Z_Z</eid>
            </BarLine>
```

Staff-level from/to (a 1-line percussion staff) —
`src/engraving/tests/compat114_data/tamtam-ref.mscx:44-45`:

```xml
        <barLineSpanFrom>-4</barLineSpanFrom>
        <barLineSpanTo>4</barLineSpanTo>
```

### D.5 The pre-3.x model change: an int COUNT became a per-staff BOOL

In 1.x/2.x, `barLineSpan` was **the number of staves the line covers**, with `from`/`to` attributes:
`src/engraving/tests/compat206_data/barlines.mscx:485-488`:

```xml
        <BarLine>
          <subtype>normal</subtype>
          <span from="0" to="8">2</span>
          </BarLine>
```

Read into a side table (the count cannot be converted until the total staff count is known) —
`src/engraving/rw/read206/read206.cpp:849-860` (staff) and `:2693-2703` (barline), parked in
`ReadContext::m_staffBarLineSpanValues` / `m_barLineSpanValues`
(`src/engraving/rw/read400/readcontext.h:200-201`, accessors `readcontext.cpp:296-320`).

The conversion is one function — `Read114::setBarLineSpanToStaves`,
`src/engraving/rw/read114/read114.cpp:3221` (shared by read206 via `read206.cpp:3654`):

```cpp
// also propagates to non-generated bar lines
void Read114::setBarLineSpanToStaves(Score* score, const read400::ReadContext& ctx)
{
    const size_t numStaves = score->nstaves();
    size_t barLineSpan = 0;
    for (Staff* s : score->staves()) {
        const staff_idx_t staffIdx = s->idx();
        const size_t maxSpan = numStaves - staffIdx - 1;
        size_t staffBarLineSpan = ctx.getStaffBarLineSpan(staffIdx);
        if (staffBarLineSpan > maxSpan) {
            LOGW() << "invalid barline span " << staffBarLineSpan << " (max " << maxSpan << ")";
            staffBarLineSpan = maxSpan;
        }
        barLineSpan = std::max(barLineSpan, staffBarLineSpan);
        if (barLineSpan == 0) {
            s->setProperty(Pid::STAFF_BARLINE_SPAN, false);
            continue;
        }
        --barLineSpan;
        s->setProperty(Pid::STAFF_BARLINE_SPAN, true);
    }
}
```

⭐ **This is the model change in one loop**: one staff carrying "span = 3" becomes three consecutive
staves each carrying `barLineSpan == true` — a running counter decremented per staff, with `std::max`
so overlapping runs merge. The converted file (`compat206_data/barlines-ref.mscx:484-487`) then has
`<span>1</span>` on the barline items and **no** `<barLineSpan>` on the staves at all — the whole
score expressed as local overrides.

---

## E. WHICH MUSESCORE OBJECT EACH OF OURS CORRESPONDS TO

(Our side read at `/home/kiko/dev/opus-editor`, working tree at `3febdd2`.)

| MuseScore | ours | note |
|---|---|---|
| `BarLine` (an item per staff per segment, id'd, selectable, with its own properties) | **nothing** — `docs/plans/barline-types-plan.md:79-81`: *"It is not an object. There is no `Barline` type, no id, no field: `score.measures` IS the barline spine"* | ours is a boundary between `Measure[n]` and `Measure[n+1]` |
| `BarLineType` (11 kinds, `barline.cpp:55-67`) | `BarlineStyle = 'final' \| 'invisible'` (`src/types/music.ts:1999`) + `Measure.repeatStart` / `repeatEnd` (`:2212,2215`) | ours splits "style" from "repeat" deliberately |
| `Measure::repeatStart()/repeatEnd()` driving `blType` in `createEndBarLines` | `Measure.repeatStart?: RepeatStart` / `repeatEnd?: RepeatEnd` | same idea, ours is the storage rather than a flag |
| `Staff` (`m_barLineSpan`, `m_barLineFrom`, `m_barLineTo`, staff type, lines, brackets) | `StaffInfo { id, size? }` (`src/types/music.ts:2237-2249`) | **that is the entire staff object** |
| `BracketItem` / `Score::brackets(staffIdx)` | `StaffGroup { id, staffIds[], symbol? }` (`src/types/music.ts:2258-2264`) — written by `ScoreModel.ensureSingleGroupSpansAllStaves()`, serialized, **never read for rendering** | our group is closer to MuseScore's *bracket*, not to its span |
| `ScoreGroup::barLineSpan` (score-order template, `scoreorder.h:49`) | nothing | |
| `InstrumentTemplate::barlineSpan` (instruments.xml) | nothing — we have no instrument object at all | |
| `BarLine::m_spanStaff` per item | nothing | |
| `BarLine::calcY()` computing `y1..y2` across the gap | `BarlineRenderer` `signStaff` (`src/engine/rendering/staff/BarlineRenderer.ts:312-322`) — `topY = stave.getTopLineTopY()`, `botY = stave.getBottomLineBottomY()`, always **one** stave | |
| `TDraw::draw(BarLine)` — one `drawLine(y1,y2)` | `ctx.fillRect(x + stroke.x*space, topY, stroke.width*space, botY - topY)` (`BarlineRenderer.ts:198`) | ours is a fillRect per stroke per staff |
| `barlineSign` equivalent (stroke/dot geometry) | `src/engine/layout/barlineSign.ts` — **x-geometry only, deliberately**: *"The vertical position is NOT here: it is read off the STAFF"* (`:163-164`) | MuseScore has no analogue; its stroke offsets are inline in `TDraw` |
| `drawTips` guarded by `isTop()`/`isBottom()` (`tdraw.cpp:695-712`) | our wings are drawn on **every** staff — `BarlineRenderer.ts:453-460` records this as a deliberate divergence, on his instruction, *"⭐ Both of those follow from a barline that SPANS the staves, and ours does not"* | |
| `MeasureLayout::createSystemBeginBarLine` (`measurelayout.cpp:2058`, `bl->setSpanStaff(true)` **hardcoded** at `:2087`) + `Staff::m_hideSystemBarLine` | `ScoreRenderer.drawSystemConnector` (`:4369-4387`) — a hand-drawn `fillRect` from staff 0's line 0 to the last staff's bottom, only at `isFirstInLine && staffIndex === 0` | **our closest analogue, and the only cross-staff stroke we draw.** MuseScore's is a real `BarLine` item with span forced true; ours is a bare rect. Neither consults a group |
| `hitShape()` = the full-span rect (`tlayout.cpp:1280` + `engravingitem.cpp:2813`), so a click in the gap selects the barline | nothing — our barline hit boxes are per-staff (`BarlineRenderer.ts:280`) and the gap is dead | |
| `Sid::scaleBarlines` (false by default: a barline divides the SYSTEM) | we DO scale per staff — `BarlineRenderer.ts:296-299` records the divergence | |
| `Staff::setProperty(STAFF_BARLINE_SPAN)` walking every measure | nothing | |
| `ChangeProperty(staff, Pid::STAFF_BARLINE_SPAN, …)` | nothing | |
| Properties-panel "Span to next staff" / "Span from" / "Span to" / "Set as staff default" | nothing | |
| Barline **grip** + `endDragGrip` snap-to-nearest-staff | nothing — our barline selection is `{ kind: 'barline', measure: N }`, staff-less by design (`docs/plans/barline-types-plan.md:82-84`) | |

### What we do not have at all

1. **No span concept.** No `barLineSpan` on `StaffInfo`, no `spanFrom`/`spanTo`, no per-item override.
   `spanStaff`, `barlineSpan`, `connectBarlines`, `bar.thru` have **zero** hits in `src/`.
2. **No ink between two staves at any bar end.** Every stroke is `topY → botY` of one stave
   (`BarlineRenderer.ts:198,312-322`). The inter-staff gap is bare at every interior barline.
3. **The system connector is not a barline and knows no groups** — always plain, always thin, always
   at system-open x, always top-staff-to-bottom-staff (`ScoreRenderer.ts:4022-4041`).
4. **No brace/bracket rendering.** `StaffGroup.symbol` has no writer and no renderer.
5. **The stored per-staff SCOPE is unread.** `BarlineStatement.staffId?`, `RepeatStart.staffId?`,
   `RepeatEnd.staffId?` (`src/types/music.ts:2021-2029, 2043-2045, 2084-2094`) are written by
   `barlineOps` and round-trip through JSON, but `BarlineRenderer`, `barlineSign`,
   `interactions/elements/barline.ts` and `interactions/barlineStamp.ts` contain **zero** `staffId`
   references.
   ⚠️ And the model's own doc comment is right to warn against conflating them —
   `src/types/music.ts:2010-2015`: *"⛔ Do not read it as 'which staves the line spans': span is a
   property of the STAFF everywhere (MuseScore `Staff::barLineSpan`, LilyPond's `SpanBar` grob,
   Verovio `@bar.thru`), never of the line."* **This report confirms that sentence is accurate for all
   three engines.**
6. **No "the line spans, the dots do not" behaviour** (plan §4.5) — every staff gets its own dots and
   its own wings.
7. **No shape-vs-bbox distinction** — MuseScore clips the *collision* shape to the staff while the
   *selection* bbox includes the span (`tlayout.cpp:1188-1233` vs `:1244-1247`). We have no spanning
   ink, so the question has not arisen.

---

## APPENDIX — LilyPond and Verovio

Three engines, three different mechanisms, one shared conclusion: **span is a property of the staff or
of the enclosing group, never of the barline glyph.**

### LilyPond (`beedbfa`) — a SEPARATE GROB in the PARENT CONTEXT, drawing only the gaps

⚠️ `lily/span-bar.cc` no longer exists; the class was ported to Scheme
(`scm/bar-line.scm:1038-1043`: *"Ported from c++ to Scheme by Marc Hohl."*). Only
`lily/span-bar-engraver.cc` and `lily/span-bar-stub-engraver.cc` remain in C++.

- The engraver **lives in the grouping context**: `ly/engraver-init.ly:474` `\consists
  Span_bar_engraver` inside `\context { \name StaffGroup … }`; `GrandStaff` (`:522`) and `PianoStaff`
  inherit it; **`ChoirStaff` explicitly `\remove Span_bar_engraver`** (`:546`).
- It collects the child staves' own `BarLine` grobs by acknowledger and makes one extra item —
  `lily/span-bar-engraver.cc:60-71`, `:80-88`:
  ```cpp
  void Span_bar_engraver::acknowledge_bar_line (Grob_info_t<Item> info)
  {
    auto *const it = info.grob ();
    if (!it->internal_has_interface (ly_symbol2scm ("span-bar-interface")))
      { bars_.push_back (it); if (bars_.size () >= 2 && !spanbar_) make_spanbar_ = true; }
  }
  ...
      spanbar_ = make_item ("SpanBar", SCM_EOL);
      for (auto *const bar : bars_)
        Pointer_group_interface::add_grob (spanbar_, ly_symbol2scm ("elements"), bar);
  ```
- The grob has **no Y-extent of its own** — `scm/define-grobs.scm:3262` `(Y-extent . (+inf.0 . -inf.0))`,
  described as *"the parts of a multi-staff bar line that are outside of staves"*.
- The stencil is built **one segment per gap**, `scm/bar-line.scm:1082-1113`:
  ```scheme
        ;; the span bar reaches from the lower end of the upper staff
        ;; to the upper end of the lower staff - when allow-span-bar is #t
        (reduce (lambda (curr prev)
                  (let ((span-extent (cons 0 0)) ...)
                    (when (positive? (interval-length prev))
                      (set! span-extent (cons (cdr prev) (car curr)))
  ```
- A separate `span-bar-glyph-alist` (`bar-line.scm:990`) can map an in-staff glyph to a *different*
  span glyph.
- `SpanBarStub` grobs are created in crossed contexts that have no barline (Lyrics, Dynamics) purely
  for pure-height calculation — `lily/span-bar-stub-engraver.cc:33-45`.

### Verovio (`efff0bc`) — ONE BarLine object, a recursive walk over the StaffGrp tree

- No span object at all. `View::DrawBarLines` recurses the `StaffGrp` tree carrying `yBottomPrevious`
  — `src/view_page.cpp:680-695`, `:747-748`, `:778-798`:
  ```cpp
      const bool barlineThrough = barLine->IsDrawnThrough(staffGrp);
      ...
      bool drawOutsideStaff = !methodTakt && barlineThrough;
      ...
      if (drawInsideStaff) { this->DrawBarLine(dc, yTop, yBottom, barLine, form); ... }
      if (drawOutsideStaff && (yBottomPrevious != VRV_UNSET)) {
          this->DrawBarLine(dc, yBottomPrevious, yTop, barLine, form, true, eraseIntersections);
      }
      yBottomPrevious = drawOutsideStaff ? yBottom : VRV_UNSET;
  ```
  — so, like LilyPond, the between-staff run is its own segment; unlike LilyPond it comes from the
  same object and the same glyph.
- The flag is the MEI `@bar.thru` on `<staffGrp>`, inherited from the nearest ancestor that has it,
  **default false** — `src/barline.cpp:87-96`:
  ```cpp
  bool BarLine::IsDrawnThrough(const StaffGrp *staffGrp) const
  {
      while (staffGrp) {
          if (staffGrp->HasBarThru()) { return (staffGrp->GetBarThru() == BOOLEAN_true); }
          staffGrp = dynamic_cast<const StaffGrp *>(staffGrp->GetParent());
      }
      return false;
  }
  ```
  Att class `AttStaffGrpVis` (`libmei/dist/atts_visual.h:2091`), parsed at
  `libmei/dist/atts_visual.cpp:2064`, MEI-3 spelling `barthru` upgraded at `src/iomei.cpp:9125`.
- Verovio *also* punches holes where system text crosses the between-staff segment —
  `src/view_page.cpp:847` `FindAllIntersectionPoints(line, lines, { CPMARK, DIR, DYNAM, TEMPO }, margin)`
  — the same job as MuseScore's `MaskLayout::computeBarlineMasks`.

### One-line contrast

| | who owns the span | what is drawn |
|---|---|---|
| **MuseScore** | `Staff::barLineSpan` (bool per staff, chained), copied onto every `BarLine` item | the upper staff's own item is drawn *longer*, one `drawLine` from its top line to the next visible staff's top line |
| **LilyPond** | the enclosing **context** (StaffGroup/GrandStaff/PianoStaff `\consists Span_bar_engraver`) | an extra `SpanBar` grob in the parent context, one stencil per inter-staff gap, possibly a different glyph |
| **Verovio** | `@bar.thru` on the enclosing `<staffGrp>`, inherited, default false | one `BarLine` object; a recursive walk emits an in-staff segment per staff plus a gap segment when through |

---

## UNKNOWNs

1. ~~Whether brackets and barline span are coupled at layout time.~~ **Resolved: they are not, with
   one exception.** The only bracket→barline reference in the whole layout is
   `measurelayout.cpp:2071` — a *single-staff* system gets an opening barline if it is bracketed.
   Bracket vertical extent (`SystemHeaderLayout::layoutBracketsVertical`, `systemheaderlayout.cpp:297`)
   and barline extent (`BarLine::calcY`) are computed independently from the same `SysStaff` y's.
   They are correlated only at score-construction time (instrument template, `ScoreOrder`,
   `Score::updateBracesAndBarlines`, `Score::remapBracketsAndBarlines`).
2. **`src/engraving/tests/barline_tests.cpp:218-219`** expects `seg->element(1) == nullptr` after the
   top staff's start-repeat barline is given `spanStaff = true` (*"check start-repeat bar line in
   second staff is gone"*). I could not find the code that removes it — `MeasureLayout::barLinesSetSpan`
   (`measurelayout.cpp:775`) unconditionally creates one barline per staff, and
   `MeasureLayout::createEndBarLines` (`:920-947`) likewise. Either that expectation depends on layout
   not re-running inside the test's `endCmd()`, or a removal path exists that I did not find.
   `Segment::getElement` (`segment.cpp:1555-1573`) is written to *tolerate* a missing lower barline, so
   the state is at least legal.
3. **Whether the "0 = staff bottom line" comment at `staff.h:275` is intended to describe the spanning
   case.** The code (§A.5) measures `spanTo` from the *next* staff's **top** line when spanning. I read
   the comment as stale, but I did not find a commit or comment confirming that.
4. **`src/engraving/dom/scoreorder.cpp:436`** — `instrTemplate->barlineSpan[barlineSpansAllStaves - 1 ? 0 : staffIdx]`
   does `bool - 1`, so the branch is the *opposite* of what the comment at `:431` and the parallel
   bracket ternary at `:433` describe. It happens to be correct for Piano. Whether this is a latent bug
   or deliberate is UNKNOWN.
5. **`Staff::init(const Staff*)`** (`staff.cpp:1163-1186`) copies `m_barLineFrom`/`m_barLineTo` but not
   `m_barLineSpan`. Whether that omission is deliberate (relying on `remapBracketsAndBarlines`) is
   UNKNOWN.

---

# PART 3 — LilyPond and Verovio, at the level of the data model

# How three engines model a barline that runs through two or more staves

Read on disk, 2026-08-28. No builds, no clones, no web.

| repo | revision read |
|---|---|
| `~/dev/engine-sources/lilypond` | `beedbfa` *Add Changes entry for book/bookpart local scopes* |
| `~/dev/engine-sources/verovio`  | `efff0bc` *Merge PR #4367 from rism-digital/develop-show-hidden* |
| `~/dev/engine-sources/MuseScore`| `929d1e9` *Merge PR #34619 from Eism/issue_template_update_url* |
| `~/dev/engine-sources/inkscape` | `e1e8684` (not relevant, not read) |

Everything below is quoted from source unless explicitly labelled otherwise.

---

## 0. The one-line answer per engine

| | who owns "these staves are joined" | the join is… |
|---|---|---|
| **LilyPond** | the **CONTEXT** (`StaffGroup` and its derivatives) — by *which engraver it consists*. Plus a per-`BarLine` veto property `allow-span-bar` / `allow-span-bar-above`. | a **separate grob**, `SpanBar`, holding pointers to the staff `BarLine`s |
| **Verovio / MEI** | the **`<staffGrp>`** element — `StaffGrp` + attribute `@bar.thru` (`AttStaffGrpVis::GetBarThru`) | the **same `BarLine` object**, drawn as extra segments in the gaps |
| **MuseScore** | **both**: `Staff::m_barLineSpan` (the default) *and* `BarLine::m_spanStaff` (the per-instance override) | the **same `BarLine` element**, whose y-extent is extended to the spanned staff |

---

## 1. LilyPond

### 1.1 Q1 — who owns the join

Two different owners, at two different granularities.

**(a) The capability is a CONTEXT fact — which engraver the context consists.**
`ly/engraver-init.ly:471–478`:

```
\context {
  \type Engraver_group
  \name StaffGroup
  ...
  \consists Span_bar_engraver
  ...
  \consists Span_bar_stub_engraver
```

and the `\description` of the same context (`ly/engraver-init.ly:530–532`):

> *"Connect staves vertically by adding a bracket on the left side. The bar lines of the contained staves are connected vertically, too."*

**(b) The per-line veto is a GROB PROPERTY on each staff `BarLine`.**
`scm/define-grob-properties.scm:47–48`:

```
(allow-span-bar ,boolean? "If false, no inter-staff bar line will
be created below this bar line.")
```

`scm/define-grob-properties.scm:1543–1544` (the "internal" half):

```
(allow-span-bar-above ,boolean? "If false, no inter-staff bar line will
be created above this item.")
```

Both default `#t` on `BarLine` (`scm/define-grobs.scm:269–270`) and on `SpanBarStub`
(`scm/define-grobs.scm:3286–3287`).

⭐ Note what is NOT there: **no staff-level "span" field**, and **no field on the bar-line
statement saying which staves it covers**. The join is (context) × (per-line boolean).

### 1.2 Q2 — a separate object, with a back-pointer

`SpanBar` is a distinct grob, created by `Span_bar_engraver` the moment a *second* staff bar line
is acknowledged in the same timestep — `lily/span-bar-engraver.cc:61–95`:

```cpp
void Span_bar_engraver::acknowledge_bar_line (Grob_info_t<Item> info)
{
  auto *const it = info.grob ();
  if (!it->internal_has_interface (ly_symbol2scm ("span-bar-interface")))
    {
      bars_.push_back (it);
      if (bars_.size () >= 2 && !spanbar_)
        make_spanbar_ = true;
    }
}
...
      spanbar_ = make_item ("SpanBar", SCM_EOL);
      for (auto *const bar : bars_)
        Pointer_group_interface::add_grob (spanbar_, ly_symbol2scm ("elements"), bar);
```

So the existence test is purely **"did ≥2 bar lines happen in this context at this moment"** —
not a stored attribute anywhere.

The engraver then writes back onto each staff bar line a **pair** (span-below . span-above),
`lily/span-bar-engraver.cc:136–145`:

```cpp
const bool allow_below
  = !is_bottom
    && from_scm<bool> (get_property (bar, "allow-span-bar"))
    && from_scm<bool> (get_property (bars_[i + 1], "allow-span-bar-above"));
set_object (bar, "has-span-bar",
            scm_cons (allow_below ? spanbar_->self_scm () : SCM_BOOL_F,
                      allow_above ? spanbar_->self_scm () : SCM_BOOL_F));
```

That back-pointer is read by the staff bar line's own drawing — e.g. bracket tips are suppressed
where a span bar meets the line (`scm/bar-line.scm:607–615`):

```scheme
(has-span-bar (if is-span ; don't add tips to span bar
                  '(#t . #t)
                  (ly:grob-object grob 'has-span-bar '(#f . #f))))
(tip-up-stil (if (not (cdr has-span-bar)) (get-tip "brackettips.up") empty-stencil))
```

— and by `bar-line::widen-bar-extent-on-span` (`scm/bar-line.scm:694–714`), which lengthens the
staff bar line by half a staff-line thickness *on the side where a span bar exists* so the two
segments meet cleanly.

The `SpanBar` grob draws **only the gaps**: `ly:span-bar::print` sorts the member bar lines by y,
takes each adjacent pair, and fills `(cdr prev) … (car curr)` (`scm/bar-line.scm:1084–1108`):

```scheme
;; the span bar reaches from the lower end of the upper staff
;; to the upper end of the lower staff - when allow-span-bar is #t
(reduce (lambda (curr prev)
          (let ((span-extent (cons 0 0))
                (allow-span-bar (car make-span-bars)))
            ...
            (set! span-extent (cons (cdr prev) (car curr)))
            (and (> (interval-length span-extent) 0)
                 allow-span-bar
                 (set! span-bar (ly:stencil-add span-bar
                    (span-bar::compound-bar-line model-bar bar-glyph span-extent))))
```

`SpanBar`'s definition (`scm/define-grobs.scm:3262–3281`) confirms it is its own grob class with
its own stencil/width/anchor callbacks and description:

> *"A span bar, i.e., the parts of a multi-staff bar line that are outside of staves."*

There is also `SpanBarStub` (`scm/define-grobs.scm:3284–3305`, `lily/span-bar-stub-engraver.cc:32–48`),
an invisible placeholder created in non-staff contexts (Lyrics, Dynamics) that a span bar crosses,
"for pure height calculations ONLY".

### 1.3 Q3 — where the grouping comes from

Directly from the **context type**, i.e. from the engraver list. `ly/engraver-init.ly`:

- `StaffGroup` — `\consists Span_bar_engraver` (line 474), `systemStartDelimiter = #'SystemStartBracket` (line 481) ⇒ **bracket + joined**.
- `GrandStaff` — `\context{ \StaffGroup \name GrandStaff` (line 537–540), `systemStartDelimiter = #'SystemStartBrace` ⇒ **brace + joined** (inherits the engraver).
- `PianoStaff` — `\context{ \GrandStaff \name PianoStaff` (line 550ff) ⇒ **brace + joined**, plus `Keep_alive_together_engraver`.
- `ChoirStaff` — `\context { \StaffGroup \name ChoirStaff \remove Span_bar_engraver` (`ly/engraver-init.ly:547–549`):

```
\context {
  \StaffGroup
  \name ChoirStaff
  \remove Span_bar_engraver
  ...
  \description "Identical to @code{StaffGroup} except that the
contained staves are not connected vertically."
}
```

⭐ **So the join and the bracket are genuinely independent axes.** `ChoirStaff` = bracket, no join;
`StaffGroup` = bracket + join; `GrandStaff` = brace + join. The bracket is `systemStartDelimiter`
(a context property); the join is engraver membership.

`Score` itself does **not** consist `Span_bar_engraver` (the only three occurrences in
`engraver-init.ly` are lines 474, 478 and the `\remove` at 549) — so bare `\new Staff` staves at
top level are unjoined by construction.

### 1.4 Q4 — can the join vary mid-score?

**Yes, and it is a positional grob override, not a structural change.**
The engraver consults `allow-span-bar` afresh **at every timestep** (`span-bar-engraver.cc:136–140`,
quoted above), so a `\once \override` at a moment removes exactly that one inter-staff segment.
The regression test is `input/regression/span-bar-partial.ly:4–8`:

> *"Span bars can be turned on/off on a staff-by-staff basis. Bar 2 should have no span bar between
> the top and the middle staves. Bar 3 should have no span bar between the middle and the bottom
> staves."*

and the mechanism, `input/regression/span-bar-partial.ly:21`:

```
\once \override Staff.BarLine.allow-span-bar = ##f
```

Note the **asymmetry that makes it work**: the property lives on the bar line *above* the gap
(`allow-span-bar` = "no inter-staff bar line below this bar line"), with the mirror
`allow-span-bar-above` on the one below. A gap is drawn only if **both** agree. So "which gap"
is addressed by *the staff bar line that owns it*, and the span statement is per-gap, per-moment.

The *capability* (does this group ever join) is structural — `\consists` / `\remove` in a
`\layout` or `\with` block — and cannot vary mid-score.

### 1.5 Q5 — Mensurstrich

⭐ **The same field as everything else: the bar GLYPH string.** LilyPond registers a bar type whose
*staff* glyph is empty and whose *span* glyph is a line. `scm/bar-line.scm:1344`:

```scheme
(define-bar-line "-span|" #t #f "|") ; mensurstrich
```

The first argument is the mid-line glyph; `-` is `annotation-char` (`scm/bar-line.scm:82`), and
`strip-string-annotation` (`scm/bar-line.scm:110–117`) cuts the string at it — so the drawn staff
glyph is `""` (nothing), while the fourth argument, the **span glyph**, is `"|"` (a line).
Result: nothing inside the staves, a line in every gap.

It is selected by the **context property `measureBarType`**, i.e. positionally — the documented
idiom, `Documentation/snippets/mensurstriche-layout-bar-lines-between-the-staves.ly:19–32`:

> *"@emph{Mensurstriche}, bar lines between but not through staves, can be printed by setting
> `measureBarType` to `"-span|"` and using a grouping context that allows span bars, such as
> `StaffGroup`."*

```
\layout { \context { \Staff measureBarType = "-span|" } }
```

`measureBarType` is a context property with `#'()` as its Score default
(`ly/engraver-init.ly:141`) and `"|"` at Staff level (`ly/engraver-init.ly:836`), so it can be set
at any point in the music.

There is a second, unrelated knob that is often confused with this: `BarLine.bar-extent`
(`scm/define-grob-properties.scm:86–88`) —

```
(bar-extent ,number-pair? "The Y-extent of the actual bar line.
This may differ from @code{Y-extent} because it does not include the
dots in a repeat bar line.")
```

That is the *height of the drawn line within a staff*, a different field from the join. **UNKNOWN**
whether any in-tree snippet uses `bar-extent` for Mensurstrich; the tree's own answer is the
`"-span|"` bar type.

### 1.6 Q6 — the dots of a repeat across a span

**Our claim is CORRECT for LilyPond, and the mechanism is exactly as our notes describe.**

Every bar type registers a *span* glyph alongside its normal glyph
(`scm/bar-line.scm:138–191`, `define-bar-line bar-glyph eol-glyph bol-glyph span-glyph`;
the alist is `span-bar-glyph-alist`, `scm/bar-line.scm:194`). For the repeats
(`scm/bar-line.scm:1307–1322`):

```scheme
;; repeats
(define-bar-line ":|.:" ":|." ".|:"  " |.")
(define-bar-line ":..:" ":|." ".|:" " ..")
(define-bar-line ":|.|:" ":|." ".|:" " |.|")
(define-bar-line ":.|.:" ":|." ".|:" " .|.")
(define-bar-line ":|." #t #f " |.")
(define-bar-line ".|:" #f #t ".|")
...
(define-bar-line ":|]" #t #f " |]")
```

Read `":|."` → span `" |."`: the `:` (dots) column has become a **space**. That space is
`replacement-char`, `scm/bar-line.scm:83`:

```scheme
(define replacement-char #\ )
```

In the span stencil, a leading replacement char is dropped outright and an interior one becomes an
*empty stencil of the right width*, `scm/bar-line.scm:996–1019`:

```scheme
;; the stencil stack routine is similar to the one
;; used in bar-line::compound-bar-line, but here,
;; leading replacement-chars are discarded.
(if (not (and (string=? span (string replacement-char)) is-first-stencil))
    ...
    ;; if the current glyph is the replacement-char,
    ;; we take the corresponding glyph from the
    ;; bar-glyph-list and insert an empty stencil
    ;; with the appropriate width.
    (if (string=? span (string replacement-char))
        ((make-spacer-bar-line bar) #t grob extent)
        (glyph->stencil span #t grob extent))
```

with (`scm/bar-line.scm:630–636`):

```scheme
(define ((make-spacer-bar-line glyph) is-span grob extent)
  "Draw an invisible bar line which has the same dimensions as the one
drawn by the procedure associated with glyph @var{glyph}."
```

And the *staff* bar line reciprocates so the two stay aligned: any glyph whose span counterpart is
a replacement char and which is leading is built into a **negative-x "neg-stencil"** attached to the
left, so that the main stencil starts at x = 0 (`scm/bar-line.scm:757–796`):

```scheme
;; We build up two separate stencils first:
;; (1) the neg-stencil is built from all glyphs that have
;;     a replacement-char in the span bar
;; (2) the main stencil is built from all remaining glyphs
;;
;; Afterwards the neg-stencil is attached left to the
;; stencil; this ensures that the main stencil starts
;; at x = 0.
```

⭐ That is the real point of the design: **the dots are not merely omitted from the span — the
coordinate origin is defined by the part that IS shared**, so the through-line lands on the same x
as the staff bar's lines while the dots hang off to the left in each staff.

Supporting: `bar-extent`'s own doc (quoted in §1.5) says the bar-line extent *"does not include the
dots in a repeat bar line"*, and `ly:span-bar::print` computes each gap from
`bar-line::bar-y-extent` (`scm/bar-line.scm:716–722`), which uses `bar-extent`. So the span's
vertical arithmetic is dot-free too.

---

## 2. Verovio / MEI

### 2.1 Q1 — who owns the join

**`StaffGrp` (the MEI `<staffGrp>` element), attribute `@bar.thru`.** It is read in exactly one
place, `src/barline.cpp:86–95`:

```cpp
bool BarLine::IsDrawnThrough(const StaffGrp *staffGrp) const
{
    while (staffGrp) {
        if (staffGrp->HasBarThru()) {
            return (staffGrp->GetBarThru() == BOOLEAN_true);
        }
        staffGrp = dynamic_cast<const StaffGrp *>(staffGrp->GetParent());
    }
    return false;
}
```

Three facts fall straight out of that:
- the attribute is looked up on the group, then **inherited up the nested-group chain**;
- **the default, when no ancestor states it, is `false`** — staves are *not* joined;
- the *barline* asks the *group*; nothing about the join is stored on the barline.

Parsed from MEI at `src/iomei.cpp:9127`:

```cpp
vrvStaffGrp->SetBarThru(vrvStaffGrp->AttStaffGrpVis::StrToBoolean(staffGrp.attribute("barthru").value()));
```

and mapped from MusicXML's `<group-barline>` at `src/iomusxml.cpp:1016`:

```cpp
if (!groupBarline.empty()) staffGrp->SetBarThru((groupBarline == "no") ? BOOLEAN_false : BOOLEAN_true);
```

(`src/iomusxml.cpp:1145` forces `BOOLEAN_true` for the multi-staff-part case, i.e. a piano part.)

### 2.2 Q2 — the same object, drawn in segments

A barline is **not** a child element in Verovio's tree; each `Measure` *owns two* `BarLine`
members, `include/vrv/measure.h:434–435`:

```cpp
BarLine m_leftBarLine;
BarLine m_rightBarLine;
```

fed from MEI's `@left`/`@right` (`AttMeasureLog`, `include/vrv/measure.h:42`) via
`SetDrawingBarLines` / `SelectDrawingBarLines` (`include/vrv/measure.h:178–184`).

The drawing walks the `StaffGrp` tree once per barline and draws **the same `BarLine` object**
several times with different y ranges — `src/view_page.cpp:680–817`. The controlling flags
(`src/view_page.cpp:777–786`):

```cpp
bool drawInsideStaff = !methodMensur && !methodTakt;
bool drawOutsideStaff = !methodTakt && barlineThrough;
bool drawTaktstrichAbove = (methodMensur && !barlineThrough) || methodTakt;
bool drawTaktstrichBelow = methodMensur && !barlineThrough;
if ((isLastMeasure && isLastSystem) || barLine->HasRepetitionDots()) {
    drawInsideStaff = true;
    drawTaktstrichAbove = false;
    drawTaktstrichBelow = false;
}
```

and the two calls (`src/view_page.cpp:788–804`):

```cpp
// Now draw the barline part inside the staff
if (drawInsideStaff) {
    this->DrawBarLine(dc, yTop, yBottom, barLine, form);
    if (barLine->HasRepetitionDots()) {
        this->DrawBarLineDots(dc, staff, barLine);
    }
}

// ... and the barline part outside the staff
if (drawOutsideStaff && (yBottomPrevious != VRV_UNSET)) {
    ...
    this->DrawBarLine(dc, yBottomPrevious, yTop, barLine, form, true, eraseIntersections);
}
yBottomPrevious = drawOutsideStaff ? yBottom : VRV_UNSET;
```

⭐ The connector is a **running variable**, `yBottomPrevious`, carried down the staff loop; the gap
segment is the same `DrawBarLine` with `inStaffSpace = true`. Recursion into a child `StaffGrp`
resets it when the outer group is not through (`src/view_page.cpp:700–704`):

```cpp
if (child->Is(STAFFGRP)) {
    StaffGrp *childStaffGrp = vrv_cast<StaffGrp *>(child);
    this->DrawBarLines(dc, measure, childStaffGrp, barLine, isLastMeasure, isLastSystem, yBottomPrevious);
    if (!barlineThrough) yBottomPrevious = VRV_UNSET;
    continue;
}
```

Whole-group hiding short-circuits the same function (`src/view_page.cpp:690–692`).

### 2.3 Q3 — grouping and bracket are separate attributes

`@bar.thru` lives in `AttStaffGrpVis` (`libmei/dist/atts_visual.h:2089`—`2124`; `StaffGrp` inherits
it at `include/vrv/staffgrp.h:37`) and is read only by `BarLine::IsDrawnThrough`. The bracket is
`@symbol` = `AttStaffGroupingSym`, and at read time it is turned into a **separate child object**,
`GrpSym` — `src/iomei.cpp:5333`—`5341`:

```cpp
    InstStaffGroupingSym groupingSym;
    groupingSym.ReadStaffGroupingSym(staffGrp);
    if (groupingSym.HasSymbol()) {
        GrpSym *vrvGrpSym = new GrpSym();
        vrvGrpSym->IsAttribute(true);
        vrvGrpSym->SetSymbol(groupingSym.GetSymbol());
        vrvStaffGrp->AddChild(vrvGrpSym);
    }
    vrvStaffGrp->ReadStaffGrpVis(staffGrp);   // <-- @bar.thru, read separately
```

The bracket is then drawn by `View::DrawGrpSym` (`src/view_page.cpp:404`—`460`), which switches on
`GetSymbol()` and never consults `bar.thru`; `DrawBarLines` never consults `@symbol`. **Fully
orthogonal** — `<staffGrp symbol="bracket" bar.thru="false">` is exactly LilyPond's `ChoirStaff`,
and MusicXML import sets the two from different XML children in adjacent statements
(`src/iomusxml.cpp:1000`—`1017`).

The **default when absent is `false`** — see the `return false` at `src/barline.cpp:94`. Importers
therefore have to opt in explicitly, which is why `src/iomusxml.cpp:1145` and the Humdrum importer
(`src/iohumdrum.cpp:6039–6416`) set it by hand.

### 2.4 Q4 — mid-score variation

**The join itself: NO — not per measure, and not even per mid-score `<scoreDef>`.** Three facts,
each from source.

*(i)* The `StaffGrp` consulted is the one hanging off the **system's** drawing scoreDef, not the
measure's — `src/view_page.cpp:1044–1054`:

```cpp
System *system = vrv_cast<System *>(measure->GetFirstAncestor(SYSTEM));
...
this->DrawScoreDef(dc, system->GetDrawingScoreDef(), measure, measure->GetLeftBarLine()->GetDrawingX(),
    measure->GetLeftBarLine());
```

and `DrawScoreDef` picks `scoreDef->FindDescendantByType(STAFFGRP)` (`src/view_page.cpp:266`) before
calling `DrawBarLines`. `Measure` has an `m_drawingScoreDef` of its own
(`include/vrv/measure.h:439–443`) that this path does **not** use for barlines.

*(ii)* A mid-score `<scoreDef>` is merged into the running state only for **clef / keySig / mensur /
meterSig** — `src/setscoredeffunctor.cpp:294–299`:

```cpp
FunctorCode ScoreDefSetCurrentFunctor::VisitScoreDef(ScoreDef *scoreDef)
{
    if (scoreDef->HasClefInfo(UNLIMITED_DEPTH) || scoreDef->HasKeySigInfo(UNLIMITED_DEPTH)
        || scoreDef->HasMensurInfo(UNLIMITED_DEPTH) || scoreDef->HasMeterSigGrpInfo(UNLIMITED_DEPTH)
        || scoreDef->HasMeterSigInfo(UNLIMITED_DEPTH)) {
        m_upcomingScoreDef.ReplaceDrawingValues(scoreDef);
```

*(iii)* And a `<staffGrp>` met mid-score contributes **labels only** —
`src/setscoredeffunctor.cpp:360–367`:

```cpp
FunctorCode ScoreDefSetCurrentFunctor::VisitStaffGrp(StaffGrp *staffGrp)
{
    // For now replace labels only if we have a section@restart
    if (m_restart) {
        m_upcomingScoreDef.ReplaceDrawingLabels(staffGrp);
    }
    return FUNCTOR_CONTINUE;
}
```

⭐ **So "bars 1–8 joined, bar 9 not" is NOT expressible in Verovio's rendering model.** The only
granularity is per `<score>`: `VisitScore` reseeds `m_upcomingScoreDef` from that score's own
`<scoreDef>` (`src/setscoredeffunctor.cpp:275–282`). The one runtime `SetBarThru` is the synthetic
ossia staffGrp (`src/setscoredeffunctor.cpp:722–731`), a copy rather than a mid-score change.

**The barline's other geometry: YES, per measure.** `bar.method`, `bar.len` and `bar.place` are
resolved with the **measure checked first**, then staffDef and its ancestors up to the scoreDef —
`src/barline.cpp:97–165`, e.g.:

```cpp
std::pair<bool, double> BarLine::GetLengthFromContext(const StaffDef *staffDef) const
{
    // First check the parent measure
    const Measure *measure = dynamic_cast<const Measure *>(this->GetParent());
    if (measure && measure->HasBarLen()) {
        return { true, measure->GetBarLen() };
    }
    // Then check the staffDef and its ancestors
    ...
        if (object->Is(SCOREDEF)) break;
```

⭐ So MEI splits the question: **"which staves does the line connect" is structural (scoreDef-level),
"what shape is the line, and how far does it reach" is positional (measure-level).**

There is also a genuine **per-staff** barline scope, but only for *invisibility*:
`Measure::m_invisibleStaffBarlines`, a `staffN → (left, right) rendition` map
(`include/vrv/measure.h:165–172`, populated at `src/measure.cpp:725, 735`), consulted only when the
group is **not** drawn through (`src/view_page.cpp:715–721`).

### 2.5 Q5 — Mensurstrich

**Fully modelled, and it is a DIFFERENT field from the join**: `@bar.method` with value
`mensur` (`data_BARMETHOD`), plus the related `takt`. `src/view_page.cpp:728–731`:

```cpp
const auto [hasMethod, method] = barLine->GetMethodFromContext(staffDef);
const bool methodMensur = hasMethod && (method == BARMETHOD_mensur);
const bool methodTakt = hasMethod && (method == BARMETHOD_takt);
```

The flags quoted in §2.2 are the whole rule:
- `mensur` + **not** through ⇒ no in-staff line, and short "taktstrich" ticks *above and below* each
  staff (`drawTaktstrichAbove/Below`), drawn one unit outward (`yTaktstrichShift`,
  `src/view_page.cpp:775`) with a total height of 2 units (`src/view_page.cpp:806–816`);
- `mensur` + **through** ⇒ no in-staff line, only the between-staff segments — i.e. true
  Mensurstrich, which is `bar.method="mensur"` **combined with** `bar.thru="true"`.

Round-tripped from MusicXML's group-barline value at `src/iomusxml.cpp:1017`:

```cpp
if (groupBarline == "Mensurstrich") staffGrp->SetBarMethod(BARMETHOD_mensur);
```

Note that this sets `@bar.method` **on the `staffGrp`** — so in practice the two attributes sit on
the same element, but they are read by different code paths and `@bar.method` can equally be set on
a `<measure>` or `<staffDef>` (§2.4).

`@bar.method` is `AttBarring`, which `StaffGrp` also inherits (`include/vrv/staffgrp.h:32`), so
`GetMethodFromContext` (`src/barline.cpp:123–146`) resolves measure → staffDef → staffGrp →
scoreDef. ⭐ Note the MusicXML mapping quoted above sets **both**: `"Mensurstrich"` is not `"no"`, so
the line before it also sets `bar.thru = true` — the combination is produced deliberately. And note
the element-level path for an in-layer `<barLine>` (`src/view_element.cpp:449–490`) handles only
`BARMETHOD_takt` (`:477`), never `mensur`: Mensurstrich exists only on the measure-barline path.

⭐ And a repeat overrides Mensurstrich: `if (... || barLine->HasRepetitionDots()) { drawInsideStaff
= true; drawTaktstrich* = false; }` (`src/view_page.cpp:782–786`).

### 2.6 Q6 — the dots of a repeat across a span

**Our claim is CORRECT for Verovio.** Dots are drawn only inside the `drawInsideStaff` branch
(`src/view_page.cpp:790–794`, quoted above), once per staff, and their y positions come **entirely
from the staff** — `src/view_page.cpp:968–971`:

```cpp
const int numDots = 3 - staff->m_drawingLines % 2; // odd => 2 dots, even => 3 dots
const int yInc = m_doc->GetDrawingDoubleUnit(staffSize); // vertical distance between dots
const int yBottom = staff->GetDrawingY() - (staff->m_drawingLines + numDots % 2) * m_doc->GetDrawingUnit(staffSize);
const int yTop = yBottom + (numDots - 1) * yInc;
```

The between-staff call `DrawBarLine(dc, yBottomPrevious, yTop, barLine, form, true, ...)` takes no
staff and never reaches `DrawBarLineDots`. The x offsets of the dots are computed relative to the
line thicknesses (`src/view_page.cpp:957–967`) — so the dots follow the lines horizontally but are
staff-local vertically.

⭐ Two extra details worth having: the dot count adapts to the staff's line count
(`numDots = 3 - lines % 2` — a 5-line staff gets 2 dots, a 4-line staff 3), which is *itself* a
reason the dots cannot be shared across staves of different line counts; and the connector segment
asks for `eraseIntersections` (`src/view_page.cpp:800`) so the through-line is cut where other ink
crosses it.

---

## 3. MuseScore — one comparison row only

*(Deliberately shallow — another agent is covering MuseScore's C++ in depth. Model level only.)*

**Two levels, and — contrary to what a one-line summary suggests — the span IS a barline property
as well as a staff one.**

Per-staff default, `src/engraving/dom/staff.h:273–275`:

```cpp
bool m_barLineSpan = false;          // true - span barline to next staff
int m_barLineFrom = 0;
int m_barLineTo = 0;
```

Per-barline instance, `src/engraving/dom/barline.h:178–180`:

```cpp
bool m_spanStaff = false;         // span barline to next staff if true
int m_spanFrom = 0;          // line number on start and end staves
int m_spanTo = 0;
```

Layout reads the **barline's own** copy (`src/engraving/dom/barline.cpp:241`):

```cpp
staff_idx_t staffIdx2 = m_spanStaff ? nextVisibleSpannedStaff(this) : staffIdx1;
```

and the staff value is only the **property default**
(`src/engraving/dom/barline.cpp:901–909`):

```cpp
case Pid::BARLINE_SPAN:
    return staff() ? staff()->barLineSpan() : false;
```

Serialization (property→tag table, `src/engraving/dom/property.cpp:103–105` and `:322–324`):
`BARLINE_SPAN → "span"`, `BARLINE_SPAN_FROM → "spanFromOffset"`, `BARLINE_SPAN_TO → "spanToOffset"`;
staff-level `STAFF_BARLINE_SPAN → "barLineSpan"`, `"barLineSpanFrom"`, `"barLineSpanTo"`.
Written at `src/engraving/rw/write/twrite.cpp:854–857` (barline) and `:2940–2942` (staff), and
`TWrite::writeProperty` (`twrite.cpp:401–411`) **skips values equal to the default** — so a barline
agreeing with its staff writes nothing, and only an overridden one emits `<span>`.

Mid-score variation: **yes**, and the local-vs-global decision is explicit in the edit code
(`src/engraving/dom/barline.cpp:579`, `:675`):

```cpp
bool localDrag = ed.control() || segment()->isBarLineType()
                 || spanStaff() != score()->staff(staffIdx())->barLineSpan();
```

local ⇒ `undoChangeProperty(Pid::BARLINE_SPAN, …)` on that one barline; otherwise
`Pid::STAFF_BARLINE_SPAN` on the Staff. `spanFrom`/`spanTo` are **staff-line numbers**, which is
what lets MuseScore express Mensurstrich (a span that starts below one staff and ends above the
next) with the same two fields rather than a separate mechanism.

⚠️ **A correction to our own notes.** `docs/plans/barline-types-plan.md` §2 says *"in all three, barline
SPAN is a **staff or group property, never a barline property**"*, and `types/music.ts`'s
`BarlineStatement` doc repeats it (*"span is a property of the STAFF everywhere"*). That is right for
LilyPond and Verovio but **wrong for MuseScore**: `BarLine::m_spanStaff` is a per-instance field
that overrides the staff and serializes as `<span>`. The conclusion the plan drew from it — that
"which staves this line covers" is a different question from "what kind of line is it" — still
stands in all three; only the "never a barline property" half is false.

---

## 4. Cross-engine summary

| question | LilyPond | Verovio / MEI | MuseScore |
|---|---|---|---|
| owner of the join | context type (`\consists Span_bar_engraver`) + per-`BarLine` `allow-span-bar` | `<staffGrp @bar.thru>`, inherited up nested groups | `Staff::m_barLineSpan` (default) + `BarLine::m_spanStaff` (override) |
| default | unjoined (Score has no span engraver) | `false` (`barline.cpp:94`) | `false` (`staff.h:273`) |
| separate object? | **yes** — `SpanBar` grob + `SpanBarStub`, with a `has-span-bar` back-pointer pair on each staff bar line | **no** — the same `BarLine` drawn again with `inStaffSpace=true` | **no** — one element, y-extent reaches to `nextVisibleSpannedStaff` |
| join ≠ bracket? | yes — `ChoirStaff` = bracket, no join | yes — `@symbol` and `@bar.thru` are read by disjoint code | UNKNOWN in this pass (bracket is a `Bracket` element on the staff) |
| varies mid-score? | **yes, positionally** — `\once \override BarLine.allow-span-bar = ##f`, evaluated per timestep | **the join: NO** — fixed per `<score>`; a mid-score `<scoreDef>` merges only clef/key/mensur/meter, a mid-score `<staffGrp>` only labels. `@bar.method`/`@bar.len`/`@bar.place`: **yes**, measure checked first | **yes** — per barline instance, serialized as `<span>` |
| Mensurstrich | a **bar TYPE** whose staff glyph is empty and span glyph is `\|` (`"-span\|"`), chosen via `measureBarType` | `@bar.method="mensur"` — a **different field** from `@bar.thru`; the two combine | `spanFrom`/`spanTo` line offsets — the **same** two fields as the join |
| repeat dots in the gap | **no** — span glyph replaces `:` with a space; leading spacer dropped, interior one becomes a zero-ink stencil "with the appropriate width" | **no** — `DrawBarLineDots` is inside the per-staff branch only, y from `staff->GetDrawingY()` | **no** (per our earlier survey; not re-verified this pass) |

**Verdict on our §4.5 claim** — *"the LINES run through the system, the DOTS do not, by three
different mechanisms"*: **confirmed** for LilyPond and Verovio from source, with the mechanisms
described accurately. The MuseScore leg was not re-verified in this pass.

---

## 5. Our side

Read: `src/types/music.ts` (`StaffInfo` ~2233, `StaffGroup` ~2258, `Score.staffGroups` ~2296,
`BarlineStatement` ~2021, `RepeatStart` ~2041), `docs/plans/barline-types-plan.md` §2 + §4.5,
`docs/plans/multi-staff-plan.md` §1 + §11.

What we hold today:

```ts
export interface StaffGroup {
  id: string
  staffIds: string[]                       // ordered members
  symbol?: 'brace' | 'bracket'             // rendering DEFERRED
}
export interface StaffInfo { id: string; size?: number }
export interface BarlineStatement {
  style: BarlineStyle                      // 'final' | 'invisible'
  staffId?: string                         // SCOPE — absent = whole system; stored, unread
  winged?: boolean
}
```

| engine's owning object | what we have | what we do not have |
|---|---|---|
| **LilyPond** `StaffGroup` context (`\consists Span_bar_engraver`) — join is a property of the *group type* | `Score.staffGroups: StaffGroup[]`, with `staffIds` and `symbol` — the grouping fact is already content (`multi-staff-plan.md` §1: *"the grouping is genuine content"*) | **any join field on the group.** `StaffGroup` has `symbol` only, so we can say *bracket* but not *joined* — we cannot express `ChoirStaff` (bracket, no join) vs `StaffGroup` (bracket + join). No `SpanBar`-equivalent object either: `BarlineRenderer` draws one line per bar end and nothing owns a gap. |
| **LilyPond** per-`BarLine` `allow-span-bar` / `allow-span-bar-above` — the positional, per-gap veto | nothing corresponding | **the per-gap, per-moment veto.** Our nearest field, `BarlineStatement.staffId`, is documented as the *scope* (*"which staves this statement governs"*), explicitly **not** *"which staves the line spans"* — and it names ONE staff, not a gap between two, and is unread. |
| **Verovio** `<staffGrp @bar.thru>` (default false), inherited up nested groups | `StaffGroup` is a flat list (`Score.staffGroups`), so the *shape* is there for one level | **`bar.thru` itself, and nesting.** `StaffGroup` has no boolean; `staffGroups` is a flat array with no parent/child, so there is no chain to inherit along. |
| **Verovio** `@bar.method = mensur` on measure/staffDef/scoreDef — Mensurstrich as a *separate* field, resolved measure-first | `BarlineStyle` is `'final' \| 'invisible'` (`types/music.ts:1999`), plus `repeatStart`/`repeatEnd` on the measure | **any between-staves-only mode.** `'invisible'` is documented as *not* "no barline" — it is the same line, unpainted — so it is not a Mensurstrich. No `bar.len`/`bar.place` equivalent: our line always spans exactly the five lines of its staff. |
| **MuseScore** `Staff::m_barLineSpan` + `BarLine::m_spanStaff` (instance override), serialized as `<span>` | `BarlineStatement`, `RepeatStart`, `RepeatEnd` are per-measure objects — the *instance* level exists, so a per-instance boolean would land in an already-positional place | **the staff-level default**, and **`spanFrom`/`spanTo`.** `StaffInfo` holds `id` + `size` only. And we have no staff-line-numbered extent, which is what MuseScore uses for both the join and Mensurstrich. |
| **all three**: the join is asked at DRAW time from a group/staff, never from the line | `BarlineRenderer` owns every line that ends a bar (per `CLAUDE.md`, `barlineSign` owns the extent) — one place would ask | **the question is never asked.** No code reads `staffGroups` at render (`multi-staff-plan.md` §11 lists brace/bracket rendering as still future), so there is no site that could consult a join. |

Three structural observations, no recommendation:

1. **We have the grouping but not the join.** `StaffGroup` carries membership + `symbol`; all three
   engines put the join *next to* those, and two of the three (LilyPond, Verovio) keep it strictly
   separable from the bracket.
2. **Our one existing per-line staff field means the opposite thing.** `BarlineStatement.staffId` is
   *scope* ("this statement governs staff X"); the engines' span field is *extent* ("this line
   reaches staff Y"). The `types/music.ts` doc already warns against conflating them.
3. **Mensurstrich is a bar TYPE in LilyPond, a METHOD in Verovio, and an EXTENT in MuseScore** —
   i.e. the three disagree about whether it belongs to the same field as the join. We have no field
   in any of the three positions.

## 6. UNKNOWNs

- *(Resolved during this pass — no longer unknown: Verovio does **not** propagate a changed
  `@bar.thru` mid-score; `setscoredeffunctor.cpp:294–299` and `:360–367`.)*
- `BARMETHOD_staff` is defined in the MEI enum (`libmei/dist/atttypes.h:245–251`) but is never tested
  for anywhere in `src/` — what Verovio would do with it is UNKNOWN.
- Whether MuseScore can separate the **bracket** from the **join** at model level (its `Bracket`
  element was not read — out of scope by instruction).
- Whether any in-tree LilyPond material uses `BarLine.bar-extent` (rather than the `"-span|"` bar
  type) as the Mensurstrich idiom.
- The MuseScore leg of the "dots do not span" claim was **not** re-verified from source in this
  pass; it rests on the earlier survey recorded in `docs/plans/barline-types-plan.md` §4.5.
- The treatises: not consulted here, and `docs/plans/barline-types-plan.md` §4.5 already records them as
  silent (Gould p. 521 covers only the systemic barline; Ross pp. 151–152 says which staves a
  barline connects and nothing about dots).
