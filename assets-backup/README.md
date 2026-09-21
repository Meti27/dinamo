# Original assets

Untouched originals of anything re-encoded for performance. Nothing here is
shipped — the directory exists so a re-encode can be undone without going
back through git history.

| file | why it was replaced |
|---|---|
| `menu/drinks-ice-tea.avif` | 131,072 B — roughly three times every other menu image at the same 520x520. Re-encoded at AVIF q80 to 44,592 B, DSSIM 0.0066 against this original, which is below the threshold where a difference is visible. |
