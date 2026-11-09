# Multi Viewer

Watch several **YouTube, Twitch, Kick and SOOP** streams side by side. Video only, no chat.

Live site (after GitHub Pages is turned on): https://genji-dragon.github.io/Multi-Viewer/

## How to use

1. Paste one or more links into the box at the top and press **Add**. You can paste several at once, separated by spaces or new lines.
2. Hover a stream to get its controls:
   - **Drag the name** onto another stream to swap places
   - **Make big**: one large player with the rest in a strip (press `Esc` to go back to the grid)
   - **Unmute/Mute**: reloads that player with or without sound (all streams start muted so they can autoplay)
   - **Reload**, **Open on site**, **Remove**
3. Press **Copy link** to share your current layout. The page address always holds your streams, so bookmarks work too.
4. Press `H` (or the arrow button) to hide the top bar.

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

## Running it locally

Twitch and YouTube won't play when `index.html` is opened as a file. Serve the folder instead:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

It's plain HTML, CSS and JavaScript, so there's no build step.
