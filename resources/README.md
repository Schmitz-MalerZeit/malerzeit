# Native App-Assets (Icons & Splash-Screens)

Dieses Verzeichnis enthält die **Quelldateien**, aus denen `@capacitor/assets`
alle benötigten Icon- und Splash-Auflösungen für Android (und später iOS) erzeugt.

## Dateien

| Datei                  | Größe       | Verwendung                                                |
| ---------------------- | ----------- | --------------------------------------------------------- |
| `icon.png`             | 1024×1024   | Legacy-Icon / Play-Store-Listing-Icon (512×512 abgeleitet) |
| `icon-foreground.png`  | 1024×1024   | Android Adaptive Icon – Vordergrund (Logo, Safe-Zone 66%)  |
| `icon-background.png`  | 1024×1024   | Android Adaptive Icon – Hintergrund (weiß)                 |
| `splash.png`           | 2732×2732   | Splash-Screen (Logo zentriert auf Navy `#1a3a6c`)          |
| `splash-dark.png`      | 2732×2732   | Splash-Screen Dark Mode (identisch zum Light-Splash)       |
| `icon-source.png`      | 1254×1254   | Original-Logo (nur als Backup)                             |

## Generieren der nativen Assets

Nachdem du das Projekt lokal ausgecheckt hast:

```bash
npm install
npx cap add android         # nur beim ersten Mal
npx cap add ios             # nur beim ersten Mal (macOS + Xcode erforderlich)
npm run build
npx cap sync

# Beide Plattformen in einem Schritt generieren:
npx @capacitor/assets generate --iconBackgroundColor '#ffffff' \
                                --iconBackgroundColorDark '#1a3a6c' \
                                --splashBackgroundColor '#1a3a6c' \
                                --splashBackgroundColorDark '#1a3a6c'

# Oder einzeln:
npx @capacitor/assets generate --android
npx @capacitor/assets generate --ios
```

`@capacitor/assets` schreibt die generierten Dateien automatisch in:

**Android**
- `android/app/src/main/res/mipmap-*/` (Launcher-Icons inkl. Adaptive Icon)
- `android/app/src/main/res/drawable*/splash.png` (Splash)
- `android/app/src/main/res/values/ic_launcher_background.xml` (Adaptive-Hintergrund)

**iOS**
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (alle Icon-Größen 20–1024 px)
- `ios/App/App/Assets.xcassets/Splash.imageset/` (1×, 2×, 3× Splash-Bilder)
- `ios/App/App/Assets.xcassets/SplashDark.imageset/` (Dark-Mode-Splash)
- Aktualisiert das `LaunchScreen.storyboard` mit Hintergrundfarbe `#1a3a6c`

## Store-Konformität

**Google Play Store**
- ✅ Icon ist quadratisch, 1024×1024, ohne Transparenz im Master
- ✅ Adaptive Icon: Logo innerhalb der 66%-Safe-Zone (kein Beschnitt durch Masken)
- ✅ Splash-Hintergrundfarbe stimmt mit `capacitor.config.ts` (`#1a3a6c`) überein
- ✅ Keine fremden Markenrechte / nur eigenes MZ-Logo

**Apple App Store**
- ✅ App-Icon 1024×1024 PNG ohne Alpha-Kanal (Pflicht für App Store Connect)
- ✅ Logo mit ausreichendem Rand (kein Beschnitt durch iOS-Eckenradius)
- ✅ Launch-Screen über Storyboard (kein veraltetes Static Image)
- ✅ Dark-Mode-Splash (`splash-dark.png`) vorhanden

## Assets neu generieren (z. B. nach Logo-Update)

Lege ein neues 1024×1024+ PNG als `resources/icon-source.png` ab und führe das
Skript `scripts/build-assets.sh` aus (oder die ImageMagick-Befehle aus dem
Lovable-Generator-Schritt erneut).
