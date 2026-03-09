# RoomFlow Style Guide

## Purpose

This document defines the default UI language for product surfaces in RoomFlow so new pages do not drift into one-off styling decisions.

## Design direction

RoomFlow should feel like a calm operational B2B product.

Principles:
- Warm, neutral surfaces over stark black or high-contrast chrome.
- Strong readability for dense operational views.
- Clear action hierarchy with as few visual variants as possible.
- Tables, badges, filters, and forms should look related across pages.
- Decoration should support clarity, not compete with the data.

## Core palette usage

Use the existing CSS tokens as the source of truth.

Primary tokens:
- `--color-canvas`: page background
- `--color-panel`: default panel surface
- `--color-panel-strong`: stronger neutral surface for controls and subtle emphasis
- `--color-ink`: primary text color
- `--color-muted`: secondary text color
- `--color-line`: borders and separators
- `--color-accent`: primary action color
- `--color-accent-strong`: primary action hover and stronger emphasis

Guidance:
- Avoid near-black filled controls for selection states unless the product explicitly needs an alert or destructive tone.
- Prefer tinted accent backgrounds for selected chips and filters.
- Use white or panel-based neutral fills for secondary actions.

## Typography

Defaults:
- Page titles: bold, high contrast, compact line-height.
- Section labels and field labels: uppercase with tracking for structure, not decoration.
- Body copy: readable muted text for supporting context.
- Dense table headers: slightly larger and heavier than row content.

## Spacing and radius

Defaults:
- Primary controls should generally use `rounded-2xl`.
- Major panels use larger radii such as `rounded-[2rem]`.
- Interactive controls on the same row should share the same vertical padding.
- Prefer `py-3` for primary and secondary buttons in app surfaces.

## Buttons

RoomFlow uses two default button styles in app views.

### Button roles

Every button should answer two questions before styling is chosen:
- What is the purpose of this action?
- Should the user be able to trigger it right now?

Purpose mapping:
- Primary action: the main forward-moving action on the current surface.
- Secondary action: a supporting action that matters, but is not the main commitment on the surface.
- Destructive action: an intentional high-risk action that changes state in a hard-to-reverse way.
- Disabled action: a visible action that preserves layout and communicates capability, but cannot be used in the current state.

Rule:
- Button styling should reflect semantic role first, not just visual preference.

### Primary action

Use for the main forward action on a surface.

Style:
- Accent fill
- White text
- `rounded-2xl`
- `px-4 py-3`
- Hover moves to `--color-accent-strong`

Use for:
- Create
- Save
- Apply
- Confirm
- Add

Disabled state:
- Keep the same shape, spacing, and text label so layout does not jump.
- Remove emphasis by muting the fill and reducing shadow strength.
- Keep text readable, but clearly subdued.
- Use for actions that are valid on the page but currently blocked by missing input, permissions, or prerequisite state.

### Secondary action

Use for supporting actions on the same surface.

Style:
- White background or neutral panel surface
- Border using `--color-line`
- Ink text
- `rounded-2xl`
- `px-4 py-3`
- Subtle neutral hover with slightly warmer border treatment

Use for:
- Reset
- Open related area
- Back
- Previous/Next pagination
- Non-destructive utility actions

Disabled state:
- Keep the control visible instead of removing it when stable layout matters.
- Use a tinted-neutral or warm muted surface rather than default white.
- Reduce contrast and remove active hover cues so it reads as unavailable at a glance.
- Best for actions such as `Reset` when there is nothing to reset yet, or pagination controls when movement is not possible.

### Destructive action

Use for actions that intentionally remove, decline, archive, or otherwise push a record into a more terminal state.

Style:
- Distinct from primary and secondary actions.
- Should carry warmer or more cautionary emphasis without looking like a generic primary CTA.
- Must still match the shared radius, spacing, and typography system.

Use for:
- Archive
- Decline
- Delete
- Cancel irreversible workflow paths

Disabled state:
- Keep the label and footprint stable.
- Use a muted caution surface rather than a bright destructive fill.
- Never let a disabled destructive button look active or clickable.

### Back navigation buttons

Decision:
- Back-navigation controls should feel like intentional navigation, not like washed-out utility buttons or plain text links.

Style:
- Use the shared secondary button shape and spacing.
- Prefer a warm cream or tinted-neutral fill over stark white when the page surface is already pale.
- Keep a visible warm border and colored text so the button reads clearly against the surrounding panel.
- Hover should deepen the warmth slightly and strengthen text contrast instead of just becoming whiter.

Rule:
- Back buttons should remain visually secondary, but they must still read as purposeful navigation actions at a glance.

### Disabled button behavior

Defaults:
- Disabled buttons should not disappear if their removal causes layout shift or makes the interface feel unstable.
- Preserve width, height, radius, and label between enabled and disabled states.
- Disabled controls should not use active hover, focus, or shadow treatments that imply clickability.
- Disabled does not mean invisible; it means visibly unavailable.

Rule:
- If an action is important enough to teach the interface, keep it visible and disabled rather than conditionally removing it.

### Decision note: leads page buttons

Decision:
- On the leads page, `Add lead` and `Apply` are both primary actions and should share the same primary button treatment.
- `Open inbox`, `Reset`, `Previous`, and `Next` are secondary actions and should share the same secondary button treatment.

Reasoning:
- Different button heights and fills on the same screen read as accidental inconsistency when they do not represent different semantic priority.
- The page should communicate hierarchy through role, not random spacing differences.

Rule:
- If two actions are both primary within the same view, they should use the same style, height, and hover behavior.
- If an action is secondary, it should use the shared secondary style rather than an ad hoc neutral variant.

Disabled-state note:
- On the leads page, `Reset` should remain visible even when inactive so the toolbar does not reflow; in that state it should use a muted warm-disabled treatment rather than disappearing or reading as a bright white button.

### Leads page primary styling refinement

Decision:
- On the leads page, primary CTAs use a stronger accent treatment than the original flat fill.

Style:
- White text that is explicitly forced on link-based primary actions.
- Accent border to give the button edge definition against warm neutral surfaces.
- Soft downward shadow to make primary actions feel intentional rather than flat.

Rule:
- If a primary CTA sits on a warm or pale surface, it should not rely on fill color alone; use border, white text, and shadow together.

## Chips and filter pills

Defaults:
- Filter chips should be rounded pills.
- Active chips should use a soft accent tint, accent-strong text, and a subtle border.
- Inactive chips should use neutral surfaces with restrained hover states.
- Do not use black fills for selected filter states in standard operational UIs.

### Summary cards

Decision:
- Summary stat cards on operational list pages may double as navigation shortcuts when they map directly to queue filters.

Style:
- Cards remain readable as metrics first, but gain clear hover affordances when clickable.
- Hover states may slightly lift the card, brighten the surface, and warm the border.

Interaction:
- Clicking a summary card should apply the relevant list filter.
- Top-level summary cards should use normal filtered navigation, not in-page anchor jumps intended for table sorting.

## Forms

Defaults:
- Inputs and selects should use the same corner radius and vertical padding as nearby actions where possible.
- Labels should stay lightweight and consistent across forms.
- Search, filter, sort, and page-size controls on list pages should look like part of one control group.

### Operational workspace cards

Decision:
- High-touch operational widgets such as owner, property, and task workspaces should use one shared warm-neutral card system rather than mixing multiple unrelated panel colors inside the same widget.

Style:
- Use one warm outer-card surface for all sibling panels in the widget.
- Use one lighter inset-card surface for nested rows, counts, empty states, and editable task items.
- Inputs and selects inside the widget should keep the elevated white control treatment with warm borders and accent-tinted focus states.
- Secondary buttons inside the widget should use the same warm neutral fill and border treatment instead of introducing a separate cooler button style.

Rule:
- If several cards belong to one operational workspace, they should read as one system at a glance. Do not place one card on a noticeably different color family unless that contrast communicates a real semantic state.

### Task workspace pattern

Decision:
- Task-management panels inside operational workspaces should feel like one coordinated toolset, not a stack of unrelated forms and lists.

Style:
- When a task form and task list sit side by side, they should share the same overall panel height so the columns align cleanly.
- The form panel should use a flex-column layout so the primary submit action can sit in a stable footer position.
- The task-list panel should keep its own internal scroll area instead of growing the full page section.
- Sort options for the task list should use compact pill controls that live inside the task panel header.
- The selected sort pill should use the shared accent fill with forced white text; inactive pills should use pale surfaces with accent-strong text.
- Summary chips such as `overdue`, `due soon`, and `open` should sit alongside the sort control and use the same rounded pill language.

Interaction:
- Task list sorting should preserve the user inside the task panel instead of jumping them back to the top of the page.
- Form submissions inside a multi-panel workspace should redirect back to the specific panel the user acted in.
- Commit actions such as `Create task`, `Update owner`, `Update property`, and `Update status` should use the shared primary CTA treatment.

Rule:
- In a multi-panel operational workspace, users should never lose their place after changing sort order or submitting a form. Preserve panel context through anchored redirects or equivalent behavior.

### Toolbar control styling

Decision:
- Search and select controls on the leads page use stronger separation from the panel background than the original washed-out treatment.

Style:
- Warm border instead of faint generic gray.
- Elevated white surface with a subtle inset highlight and outer shadow.
- Accent-tinted focus ring and border state.
- Placeholder text should remain readable and never dissolve into the panel.

Rule:
- Controls inside pale panels should still read as independent surfaces at a glance.

## Tables

Defaults:
- Prioritize stable columns and readable scan paths.
- Sticky headers should remain visually distinct with a light bottom separator or shadow.
- Sort affordances should be obvious and only appear active on the currently sorted column.
- Hover states should help row targeting without overpowering the content.

### Leads table styling

Decision:
- The leads table header should be warmer and more defined than the row surfaces.

Style:
- Sticky header cells use a tinted neutral surface rather than near-white.
- The header-bottom divider should be visually obvious, using border plus inset edge/shadow rather than a barely visible drop shadow.
- Body rows may use subtle striping to keep the header distinct and improve scan rhythm.

Interaction:
- Clicking a sortable header should keep sorting accessible without sending the user to the top of the whole page.
- Sorting should move the user to the top of the list region, not trap the page in an anchored top state.

## Status badges

Defaults:
- Status and fit badges should use tinted backgrounds and strong readable text.
- Colors should be semantically clear but not neon.
- Badge styling should be consistent between table rows and mobile cards.

### Fit badge styling

Decision:
- Fit badges on the leads page use clearly tinted fills rather than nearly white gradients.

Style:
- `PASS`: soft green surface with darker green text.
- `CAUTION`: warm orange-tan surface with accent-strong text.
- `MISMATCH`: muted rose surface with darker rose text.
- `Unknown` or default: warm neutral surface that is visibly different from white.

Rule:
- Badge background colors must be visibly perceptible against table rows. If a tint reads as white in practice, it is too weak.

### Pagination styling

Decision:
- Leads pagination should read as a compact footer toolbar, not as a detached empty card.

Style:
- Use a flatter, tighter container with warmer separators.
- Page metadata can be split into smaller pieces, with the page indicator treated as a subtle accent chip.
- The forward action may be emphasized more strongly than the backward action when a next page exists.

Rule:
- Pagination should feel attached to the list it controls and should not waste vertical space.

## Interaction rules

Defaults:
- All clickable controls should look clickable.
- Sorting a list should return the user to the top of the list region, not necessarily the top of the page.
- Pagination may intentionally scroll to the top of the list region.
- Sticky operational headers should stay visible when the user needs continuous access to sorting or context.

### Scroll behavior on app pages

Decision:
- The right-side app pane is the scroll context for operational pages.

Rule:
- Global utilities such as a scroll-to-top button should target the shared app scroll container, not the document body.
- Summary cards and top-of-page filters should not use list-anchor jump logic that can leave the page top feeling broken.
- Pagination may intentionally snap the user back to the top of the list after the next page has rendered.

## Implementation guidance

When adding a new page:
- Start with the existing tokens before creating new colors.
- Reuse the primary and secondary button styles from comparable app pages.
- Prefer extending this guide over introducing page-local variants.
- If a page needs a new visual pattern, document the reason here.
