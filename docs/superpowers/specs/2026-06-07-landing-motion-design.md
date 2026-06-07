# Landing Motion Design

## Goal

Make the landing hero video play once per page load and animate all panels below the hero upward as they enter the viewport.

## Behavior

- The hero video autoplays once, does not loop, and remains on its final frame after playback.
- A full page refresh allows the video to play again.
- Panels and cards below the hero begin slightly lowered and transparent.
- Each element rises and fades into place once when it enters the viewport.
- Cards in the same grid use short staggered delays.
- Users who prefer reduced motion see the panels immediately and do not see the hero video.

## Architecture

A small client component owns a single `IntersectionObserver` and adds an `is-visible` class to elements marked with `data-reveal`. The landing page remains a server component and supplies reveal markers and optional delay values.

## Verification

Run frontend lint and build. In the browser, verify the video stops at the end, panels reveal while scrolling, animations do not replay when scrolling upward, and mobile has no overflow.
