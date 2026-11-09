# Multi Viewer

Watch several **YouTube, Twitch, Kick and SOOP** streams side by side. Video only, no chat.

Live site (after GitHub Pages is turned on): https://genji-dragon.github.io/Multi-Viewer/

## How to use

1. Paste one or more links into the box at the top and press **Add**. You can paste several at once, separated by spaces or new lines.
2. Every stream has a title bar. **Hold the title bar and drag** it (the video itself can't be grabbed, because clicks there go to the player's own controls):
   - onto another stream to swap places, or
   - onto a spot in the **snap bar** that appears at the top middle while dragging, like Windows snap layouts. It shows the layouts that fit your number of streams, and the part of the screen the stream would take lights up before you let go.
3. Press **Layout** (or `L`) to choose how the videos are arranged, like Windows Snap Layouts:
   - **Auto** fits every stream at equal size (the default).
   - The other options are fixed layouts: side by side, one big plus a column, 2×2, 3×3 and more. Only layouts with exactly one spot per stream are shown. Adding or removing a stream goes back to Auto.
   - **Fill screen** (on by default) uses the whole window. Turn it off to keep every video exactly 16:9, which can leave empty space around them.
4. The buttons on the right of each title bar:
   - **Layout button**: pick the exact spot this stream goes in (it swaps with whatever is there)
   - **Make big** (Auto layout only): one large player with the rest in a strip (press `Esc` to go back to the grid)
   - **Volume**: mute button, plus a slider and % for YouTube and Twitch (on narrow tiles only the % shows)
   - **Reload**, **Open on site** (hidden on narrow tiles), **Remove**
5. Press **Copy link** to share your current streams and layout. The page address always holds them, so bookmarks work too.
6. Press the sun/moon button to switch between light and dark mode (it remembers your choice).
7. Press `H` (or the arrow button) to hide the top bar.

## Sound

Streams you add start playing with sound:

- **YouTube and Twitch** start at **26% volume**. Their title bar has a volume slider with the exact % from 1% to 100% (scrolling the mouse wheel over it changes it in 5% steps; mute with the speaker button). If you change the volume inside the player instead, the % on the title bar follows it.
- **Volume mixer**: press **Volume** in the top bar (or `V`) for one panel with every stream's volume, like the Windows volume mixer, plus **Mute all / Unmute all**. It stays in sync with the title bar sliders.
- **Kick and SOOP** play at their own player's volume. Their embedded players don't let other pages read or change the volume, so they have no slider; use the volume control inside the player.

When you open a shared link or bookmark, browsers keep sound off until you click somewhere on the page. A **Turn on sound** button appears, and your first click anywhere turns the sound on.

## Supported links

| Platform | Examples |
|---|---|
| Twitch | `twitch.tv/name`, `twitch.tv/videos/123`, clip links, or just `name` |
| Kick | `kick.com/name`, or `kick:name` |
| YouTube | `youtube.com/watch?v=ID`, `youtube.com/live/ID`, `youtu.be/ID`, or `yt:ID` |
| SOOP | `sooplive.com/station/id`, `play.sooplive.com/id`, old `sooplive.co.kr` / `afreecatv.com` links, or `soop:id` |

YouTube channel links (`youtube.com/@name`) can't be embedded: YouTube only embeds a specific video, so open the live stream and paste its link.

## Share link format

`https://genji-dragon.github.io/Multi-Viewer/#tw:name/k:name/yt:VIDEO_ID/s:id`

A `*` in front of one entry (for example `*tw:name`) opens it as the big player.

For a fixed layout, the layout id comes first, then one stream per spot, for example
`#@4r/k:name/tw:name/yt:VIDEO_ID/s:id` (one big on the left, three stacked on the right).

## Running it locally

Twitch and YouTube won't play when `index.html` is opened as a file. Serve the folder instead:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

It's plain HTML, CSS and JavaScript, so there's no build step.
