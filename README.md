# Multi Viewer

Watch several **YouTube, Twitch, Kick and SOOP** streams side by side. Video only, no chat.

Live site (after GitHub Pages is turned on): https://genji-dragon.github.io/Multi-Viewer/

## How to use

1. Paste one or more links into the box at the top and press **Add**. You can paste several at once, separated by spaces or new lines.
2. Press **Layout** (or `L`) to choose how the videos are arranged, like Windows Snap Layouts:
   - **Auto** fits every stream at equal size (the default).
   - The other options are fixed layouts: side by side, one big plus a column, 2×2, 3×3 and more. Layouts with fewer spots than you have streams are greyed out.
   - **Fill screen** stretches the layout over the whole window. When it's off, the layout is sized so each video is as close to 16:9 as possible.
3. Hover a stream to get its controls:
   - **Layout button**: pick the exact spot this stream goes in (it swaps with whatever is there)
   - **Drag the name** onto another stream to swap places, or onto an empty spot to move it there
   - **Make big** (Auto layout only): one large player with the rest in a strip (press `Esc` to go back to the grid)
   - **Unmute/Mute**: reloads that player with or without sound (all streams start muted so they can autoplay)
   - **Reload**, **Open on site**, **Remove**
4. Press **Copy link** to share your current streams and layout. The page address always holds them, so bookmarks work too.
5. Press the sun/moon button to switch between light and dark mode (it remembers your choice).
6. Press `H` (or the arrow button) to hide the top bar.

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

For a fixed layout, the layout id comes first and `-` marks an empty spot, for example
`#@4r/k:name/tw:name/yt:VIDEO_ID/-` (one big on the left, three stacked on the right).

## Running it locally

Twitch and YouTube won't play when `index.html` is opened as a file. Serve the folder instead:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

It's plain HTML, CSS and JavaScript, so there's no build step.
