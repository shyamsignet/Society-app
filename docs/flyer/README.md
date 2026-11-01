# Sociyo resident flyer (A4)

One-page flyer to print for the notice board / lifts or share on the society WhatsApp group.

| File | Use |
|---|---|
| `sociyo-flyer.pdf` | Ready to print. Society name, society code and office phone are blank lines – fill them in by pen. |
| `sociyo-flyer.png` | Same flyer as an image, for WhatsApp. |
| `sociyo-flyer.html` | Open in Chrome on a computer, click the grey placeholders and type your society's details, then **Ctrl+P** → A4, margins *None*, *Background graphics* on → Save as PDF / print. |
| `build-flyer.cjs` | Regenerates the flyer. |

The QR code opens **https://shyamsignet.github.io/Society-app/**.

To generate a pre-filled copy (needs Playwright/Chromium for the PDF/PNG):

```
npm run flyer -- --name "Shanti Nagar CHS" --code SHANTI42 --phone "020 1234 5678" --out -shanti
```

This writes `sociyo-flyer-shanti.html/.pdf/.png` next to this file.
