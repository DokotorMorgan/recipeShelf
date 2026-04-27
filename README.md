# Recipe Shelf

A small phone-friendly recipe viewer for local text recipes.

## Design Notes

Recipe Shelf is visually inspired by Readmill: calm reading surfaces, generous spacing,
muted pastel accents, and a bookish/editorial feel rather than a dashboard feel.

Keep the interface quiet:

- use real text for branding and recipe titles instead of baked text in images
- keep the logo mark transparent and theme-aware with CSS variables
- use pastel color as a soft accent, not as a loud UI theme
- keep recipe metadata subtle and visually separate from action buttons
- make cooking controls tactile and obvious without turning the page into a utility panel
- preserve readable typography and comfortable spacing on phone screens

Dark mode should feel native. Avoid light-background logo images, white cards inside
dark surfaces, or bitmap assets that carry their own page background.

## Convert Recipes

The converter reads the original recipe notes and writes normalized JSON for the app:

```bash
npm run convert
```

By default it reads:

```text
/mnt/c/Users/yoshi/Dropbox/Personal/Food/txt
```

Use another folder if needed:

```bash
npm run convert -- "/path/to/recipes"
```

## Run

```bash
npm start
```

Open the printed URL on the computer. For phone testing, open the LAN URL while the phone is on the same Wi-Fi.

If you are running the server inside WSL, the phone cannot use the WSL `172.x.x.x` address directly.
Use the Windows LAN IP instead, for example `http://192.168.1.176:5174`, and make sure Windows
allows and forwards the port:

```powershell
New-NetFirewallRule -DisplayName "Recipe Shelf 5174" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5174
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5174 connectaddress=<WSL_IP> connectport=5174
```

The WSL IP changes after some restarts, so if phone access stops working, update the `portproxy`
rule with the current WSL address.

## Files

- `scripts/convert-recipes.mjs`: text recipe normalizer
- `scripts/serve.mjs`: tiny local static server
- `public/index.html`: app shell
- `public/styles.css`: mobile-first layout
- `public/app.js`: recipe browser and cooking mode
- `public/data/recipes.json`: generated recipe data
