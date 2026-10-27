# Admiralty plotting table

The existing restored design is the starting point: a naval strategy game for solo play or two people sharing one device. The boards are the primary content; the controls support a quick match.

## Design tokens

- Abyss `#0b1622`: page background.
- Housing `#112233`: controls and board frames.
- Water `#17314a`: unknown coordinates.
- Chalk `#eef2f6`: main text.
- Signal cyan `#7cc6e8`: ships and the deploy action.
- Brass `#f4b950`: focus and the probability overlay.

Avenir Next / Avenir / Segoe UI carries the interface. System monospace is limited to coordinates and numeric telemetry, where aligned characters help plotting. The type scale runs from 12px secondary information to a 42px desktop heading.

## Layout and brief review

Content is left aligned. The naval line drawing introduces the subject; paired plotting grids provide the memorable visual. Avoid extra animation, generic feature cards or a separate marketing page. Retain the restored palette and ship illustration rather than imposing another visual identity.

```
Brand                                    Rules / Statistics
Naval title                              Ship drawing
Match setup     Friendly board           Enemy board
Fleet manifest  Shot log                 Probability lens
```

On phones, hide the noninteractive enemy preview during setup and the detailed manifest. Once deployed, remove disabled setup fields and show the target board first. The rules retain fleet sizes. The full manifest remains visible on larger screens.

## Interaction quality

Native buttons and selects, visible keyboard focus, coordinate labels, live shot announcements, hit/miss symbols and reduced-motion support. Arrow keys navigate the target board, with Home/End and PageUp/PageDown shortcuts. The probability lens also adds relative likelihood to accessible coordinate labels.

Shared-device handoffs hide the workspace, clear the lens and require an explicit reveal. Active-match resets need confirmation; leaving or reloading an active match triggers the browser's loss-of-progress warning. Only completed solo records persist locally.
