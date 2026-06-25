# CFC Simulator — Siemens PXC field panel (Continuous Function Chart)

A self-contained, browser-based **Continuous Function Chart (CFC)** editor and
**scan-cycle simulator**, modelling the way newer Siemens **PXC** field panels are
programmed — the graphical block-and-wire approach (authored in Siemens **ABT Site**)
that is **replacing PPCL** on these controllers.

It is a single file — [`index.html`](./index.html). No build step, no server, no
dependencies. Double-click it (or open it in any modern browser) and it runs.

![screenshot](./screenshot.png)

---

## Why this exists — PPCL → CFC

The classic Siemens APOGEE field panels were programmed in **PPCL** (Powers Process
Control Language) — a line-numbered, text-based control language:

```ppcl
00010 IF (SAT .GT. 60) THEN GOTO 100
00020 SAT_LOOP = PID(...)
00100 COOLING = SAT_LOOP
```

On the newer **Desigo PXC / PXC-Modular** platform, that text program is replaced by a
**Continuous Function Chart**: you drop ready-made **function blocks** onto a chart,
**wire** each block's outputs to downstream inputs, and set each block's **parameters**.
The panel then **evaluates the whole chart every scan cycle**, continuously — which is
exactly what this simulator does.

| PPCL concept            | CFC equivalent (here)                          |
|-------------------------|------------------------------------------------|
| `POINT` (LAI/LAO/…)     | **AI / AO / BI / BO** point blocks             |
| numeric literal / setpt | **CONST / DCONST**                             |
| `IF .GT. / .LT.`        | **GT / LT / EQ / HYST**                         |
| `.AND. .OR.` logic      | **AND / OR / NOT / XOR / RS**                   |
| arithmetic expressions  | **ADD / SUB / MUL / DIV / MIN / MAX / ABS**     |
| `ONDELAY` / `OFFDELAY`  | **TON / TOF / PULSE**                           |
| `PID(...)` statement    | **PID** block                                   |
| line-by-line execution  | topological **scan evaluation** every cycle     |

---

## Running it

- **Just open `index.html`** in a browser. That's it.
- Or serve the folder, e.g. `npx serve cfc-simulator` / `python3 -m http.server`.

Your chart **auto-saves to the browser** (localStorage). Use **Export JSON** /
**Open…** to move charts between machines.

---

## How the simulator works

Every scan cycle (default **250 ms**, adjustable):

1. Blocks are ordered by a **topological sort** of the wiring.
2. Each block reads its inputs (from wired upstream outputs, or a default if unwired),
   runs its `compute()`, and writes its outputs.
3. **Feedback loops** are allowed — a wire that forms a cycle resolves with a
   **one-scan delay**, exactly as a real cyclic controller behaves.

Live values, boolean pin colours, and animated wires update on every scan.

### Controls

| Action | How |
|--------|-----|
| Add a block | click it in the left **palette** |
| Move a block | drag it **by its header bar** |
| Wire two blocks | drag from an **output pin** → onto an **input pin** |
| Delete a block / wire | select it, press **Delete** (or use the Inspector button) |
| Edit parameters | select a block → edit in the **Inspector** (right) |
| Drive an input | use the inline **slider** (AI/CONST) or **TRUE/FALSE** toggle (BI/DCONST) |
| Run / pause | **Run** button or **Spacebar** |
| Single scan | **Step** |
| Zero all states | **Reset state** (clears timers, PID integral, latches) |
| Pan / zoom | drag empty canvas / mouse wheel |

Wires are **type-checked**: analog (blue) pins only connect to analog pins, binary
(orange) only to binary. Each input takes **one** source (re-wiring replaces it).

---

## Block library

| Category | Blocks |
|----------|--------|
| **Points** | `AI` analog input · `AO` analog output · `BI` binary input · `BO` binary output |
| **Constants** | `CONST` (analog) · `DCONST` (digital) |
| **Logic** | `AND` `OR` `NOT` `XOR` · `RS` (reset-dominant latch) |
| **Compare** | `GT` `LT` `EQ` (with tolerance) · `HYST` (hysteresis switch) |
| **Math** | `ADD` `SUB` `MUL` `DIV` `MIN` `MAX` `ABS` |
| **Timers** | `TON` (on-delay) · `TOF` (off-delay) · `PULSE` (TP) |
| **Control** | `PID` (with anti-windup) · `RAMP` · `LIMIT` · `SEL` (selector) |

Adding a block is data-driven — see the `DEFS` registry in `index.html`. A new block is
just an entry with `inputs`, `outputs`, `params`, and a `compute(I, P, S, dt)` function.

---

## The built-in example — AHU supply-air temperature control

Press **Load example (AHU)** (loaded by default). It implements a cooling-coil loop:

- **AI · SAT** — supply-air temperature sensor (drag the slider to simulate the duct
  heating up or cooling down).
- **PID · SAT loop** — direct-acting, so the **cooling valve opens as SAT rises** above
  the **CONST · SP 55 °F** setpoint.
- **BI · Occupied** + **SEL** — when unoccupied, the valve is forced to 0 %.
- **AO · Cooling valve** — the commanded valve position (%).
- **HYST · Hi-temp alarm** → **BO** — trips above 60 °F, clears below 56 °F.

Press **Run**, then drag the SAT slider up: watch the PID drive the cooling valve open
and the high-temp alarm trip.

---

## Fidelity note

This models **standard CFC / IEC 61131-3 FBD execution semantics** and a pragmatic,
field-panel-flavoured block set. Block **names and exact parameterisation** are a clean
approximation, **not** a byte-for-byte clone of Siemens' proprietary ABT Site block
library. If you provide the official PXC/ABT block reference, the `DEFS` registry can be
extended to match exact block names, pins, and behaviour.

## Roadmap ideas

- Match exact Siemens ABT Site block names / icons from the manual
- BACnet-style point properties (priority array, COV, reliability)
- Trend chart / strip recorder for selected pins
- Sub-charts (compound blocks) and a block search box
- Import a PPCL listing and scaffold an equivalent chart
