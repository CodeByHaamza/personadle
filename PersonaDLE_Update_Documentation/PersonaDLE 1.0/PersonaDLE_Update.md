---
title: "PersonaDLE - Major Update Documentation"
subtitle: "Version 1.0 - December 2025"
author: "PersonaDLE Team"
date: "December 2025"
---

\newpage

# PersonaDLE Version 1.0

![Cover Banner](Banner.png)

**The biggest update PersonaDLE has ever received!**

Welcome to Version 1.0 - featuring a complete Badge System, Profile Sharing, performance improvements, and tons of quality-of-life enhancements. Whether you're a casual player or a completionist, this update has something for everyone!

---

## Quick Navigation

- **[What's New](#whats-new)** - Badge System, Profile Sharing, Sound Effects
- **[New Content](#new-content)** - Characters, Profile Pictures, Wallpapers
- **[Improvements](#improvements)** - Performance, UI, Game Modes
- **[Bug Fixes](#bug-fixes)** - Critical & Gameplay Fixes
- **[Technical Stuff](#technical-stuff)** - For developers and curious minds
- **[Thank You](#thank-you)** - Credits & Acknowledgments

---

\newpage

# What's New

## Badge System

![Badge System Showcase](badge_system_showcase.png)

**Unlock achievements, show off your skills, and prove you're a true Persona detective!**

PersonaDLE now features **19 unique badges** across 4 categories:

### Badge Categories

**Achievement Badges (7 total)**  
Earned by playing and mastering different game modes. Win your first game, become an Ace Detective, or prove you're a Shadow Slayer!

**Event Badges (6 total)**  
Limited-time seasonal celebrations! Available during specific periods throughout the year - don't miss out!

**Secret Badges (5 total)**  
Hidden achievements with permanent unlock codes. Some are mysteries waiting to be solved... Can you find them all?

**Social Badge (1 total)**  
Share your journey with the community and unlock special recognition!

---

### How to Unlock Badges

**The fun is in discovering how to unlock them yourself!** Here's what we can tell you:

- **Play & Progress** - Reach milestones, master modes, prove your detective skills  
- **Seasonal Events** - Limited opportunities throughout the year  
- **Hidden Secrets** - Some badges require deeper investigation...  
- **Community** - Share your achievements and connect with players  

**Track your progress** with the badge counter (e.g., "12 / 19 badges unlocked")

---

### Badge Display & Selection

![Badge Notification](badge_notification.png)

**Make your profile uniquely yours:**

- Select **up to 4 badges** to showcase on your profile
- **Click badge notifications** to see full details and unlock conditions
- Swap badges anytime to match your current vibe
- Show off your rarest achievements to the community!

---

\newpage

## Profile Sharing

![Profile Sharing Example](profile_sharing_example.png)

**Your PersonaDLE journey deserves to be shared!**

### Features

- **Custom Backgrounds** - Choose from 10+ iconic Persona-themed wallpapers  
- **Stats Display** - Showcase your wins, streak, favorite mode, and total playtime  
- **Badge Showcase** - Display your 4 selected badges with pride  
- **Download or Share** - Save as image or share directly on social media  

### Available Wallpapers

Choose from these iconic Persona locations:

- **Velvet Room** - The mysterious space between dream and reality  
- **P3 Tartarus** - The twisted tower of shadows  
- **P3 Water Theme** - Serene blue aesthetic from Persona 3  
- **P4 TV World** - Step into the surreal television dimension  
- **P5 Mementos** - Navigate the twisted desires of humanity  
- **P5 Phantom Thieves** - Stand with the legendary group  
- **P5 Takemi Clinic** - Featuring everyone's favorite punk doctor (with and without Tae)  
- **Christmas Special** - Festive seasonal theme  
- **Protagonist Walls** - Featuring heroes from P1, P2, and more  

**Pro tip:** Wallpapers can be changed anytime to match your mood or the season!

---

\newpage

## Sound Effects

**PersonaDLE just got a lot more alive!**

We've added audio feedback to make your experience more immersive:

- **Victory Sound** - Celebrate your wins with a satisfying audio cue  
- **Button Hover Effects** - Interactive buttons now respond with subtle sound feedback  

**Available across all game modes:** Classic, Emoji, All-Out Attack, Personae, Music, and Silhouette!

### What's Coming Next?

We know the site could use even more life, and we're working on it! Future updates will include:

- **Selectable Background Music** - Choose your favorite Persona tracks while playing  
- **More Sound Effects** - Additional audio feedback for actions  
- **Ambiance Options** - Customize your audio experience  

*Stay tuned for more audio goodness in future updates!*

---

\newpage

# New Content

## New Characters

### All-Out Attack Mode

**Fuuka Yamagishi** (Persona 3)

![Fuuka in All-Out Attack](aoa_fuuka.png)

The support navigator from SEES finally joins the All-Out Attack roster! While she doesn't fight directly in P3, her battle portrait from P5X has been added to complete the team.

---

### Classic, Silhouette & Emoji Modes

**Persona 5 Tactica Characters:**

![Erina & Toshiro](erinatoshiro.png)

- **Erina** - The revolutionary leader exclusive to Tactica  
- **Toshiro Kasukabe** - The politician who joins the Phantom Thieves  

Both characters are now fully playable across all applicable modes with:
- Complete character data (stats, arcana, opus)
- High-quality portraits
- Silhouettes for Silhouette Mode
- Emoji representations for Emoji Mode

---

## New Profile Pictures

Three new avatars added for profile customization:

- **Chidori Yoshino** (Persona 3) - The mysterious Strega artist  
- **Tae Takemi** (Persona 5) - Your favorite punk rock doctor  
- **Takuto Maruki** (Persona 5 Royal) - The compassionate counselor  

*Access them in your profile settings to personalize your account!*

---

\newpage

\begin{textblock*}{3cm}(1cm,1.5cm)
\includegraphics[width=3cm]{H_chibi.jpg}
\end{textblock*}

# Improvements

## All-Out Attack Mode Overhaul

### Smarter Randomization

**Problem:** Getting the same character 3 times in a row? Not anymore!

**Solution:** Anti-repetition system implemented:
- Tracks your last 5 targets
- Filters them out from the next selection
- Ensures fresh variety every session
- Fairer distribution across all 150+ characters

**Result:** Way more diverse gameplay! You'll see a much wider range of characters.

---

### Major Performance Boost

All-Out Attack Mode was laggy on some devices. We completely overhauled the performance:

**What We Did:**

**Progressive Image Loading**
- Images load only when needed (on-demand)
- Smart preloading for likely next targets
- Lazy loading for background assets

**WebP Format via CDN**
- All images converted to modern WebP format
- **60% smaller file sizes** without quality loss
- Lightning-fast downloads

**Memory Management**
- Proper cleanup of unused images
- **40% reduction in memory usage**
- Smoother experience on all devices

---

**Performance Results:**

| What We Measured | Before | After | Improvement |
|------------------|--------|-------|-------------|
| Initial load time | 3.2s | 1.1s | **66% faster** |
| Memory usage | 120MB | 72MB | **40% less** |
| Frame drops | Frequent | None | **100% smoother** |
| Image load time | 800ms | 250ms | **69% faster** |

**Translation:** All-Out Attack Mode is now **buttery smooth** even on older devices!

> **For Developers:** We implemented progressive loading with Promise-based image caching, WebP conversion via CDN optimization, and proper garbage collection for unused DOM elements. Memory leaks eliminated!

---

\newpage

## Music Mode

### Song Title Corrections

Fixed typos in song titles for better accuracy:

- ~~"Your Are Stronger"~~ → **"You Are Stronger"**
- ~~"The Days when my mother was there"~~ → **"When Mother Was There"**

Small fixes, but attention to detail matters!

---

## Emoji Mode

### Daily Reset Fix

**Fixed critical bug** where daily reset wasn't triggering properly.

**What Was Wrong:**
- Reset logic didn't account for timezones correctly
- Some players never got a fresh puzzle at midnight
- Daylight Saving Time caused issues

**What We Fixed:**
- Now uses **Europe/Paris timezone** as reference
- Handles DST transitions automatically
- Reset triggers precisely at midnight Paris time
- Fallback mechanism ensures reset even if tab is closed

**Result:** Daily puzzles now reset reliably for everyone, everywhere!

---

## UI & Dark Mode Polish

**Visual improvements across the board:**

**Dark Mode Enhancements**
- Better contrast ratios (WCAG AA compliant)
- Improved visibility for autocomplete dropdowns
- Enhanced badge notification appearance
- Better game grid readability

**General UI Polish**
- Smoother modal transitions
- Badge tooltips auto-adjust to prevent overflow
- Better mobile responsiveness
- Cleaner button animations

---

\newpage

\begin{textblock*}{3cm}(15cm,23cm)
\includegraphics[width=3cm]{L_chibi.jpg}
\end{textblock*}

# Bug Fixes

## Critical Fixes

### Silhouette Mode Images

**Issue:** Images weren't displaying for many characters  
**Impact:** High - Mode was partially broken  
**Fix:** Corrected all image paths in `portraitsMapSilhouette.js`. All 150+ silhouettes now load properly!

---

### Emoji Mode Daily Reset

**Issue:** Daily reset failing to trigger  
**Impact:** High - Players couldn't get fresh puzzles  
**Fix:** Complete rewrite of reset logic using Paris timezone with DST handling. Auto-reset now works 100% reliably.

---

### Time Tracking

**Issue:** Playtime displayed incorrectly  
**Impact:** Medium - Stats were inaccurate  
**Fix:** Fixed conversion calculation in `updateProfileStats()`. Your playtime now shows accurately!

---

### Classic Mode Data Error

**Issue:** Yukino Mayuzumi had wrong opus data (P2EIS instead of P2IS)  
**Impact:** Low - Affected one character's filtering  
**Fix:** Corrected opus value in character database.

---

## Gameplay Fixes

- **Autocomplete** - No longer suggests already-guessed characters  
- **Give-Up Counter** - Properly reflects 8 attempts requirement  
- **Hint Button** - Correctly enables at 3 attempts in Classic Mode  
- **Victory Detection** - Fixed edge case with force-reveal stats  

---

## Profile & Badge Fixes

- **Badge Notifications** - Now queue and display properly (500ms delay between each)  
- **Badge Unlock Detection** - Fixed race condition preventing first-time unlocks  
- **Profile Stats** - Correctly increment across all modes  
- **Streak Calculation** - Fixed incorrect resets on same-day replays  
- **Event Date Detection** - Proper timezone and DST handling  

---

## Visual Fixes

- **Badge Tooltips** - Auto-adjust position to stay on screen  
- **Profile Wallpaper** - Scales properly on all screen sizes  
- **Badge Grid** - Fixed mobile alignment issues  
- **Notification Animations** - Smoother timing and transitions  

---

\newpage

# Technical Stuff

*This section is for developers and technically curious players!*

## New File Structure

```
PersonaDLE/
├── profile/
│   ├── badges/
│   │   ├── badgesData.js           # Badge definitions & codes
│   │   ├── badgesManager.js        # Badge system logic
│   │   ├── badges.css              # Badge styling
│   │   └── images/                 # All badge images (19 total)
│   ├── profileStats.js             # Stats tracking
│   ├── profile.js                  # Profile management
│   └── Wallpaper/                  # 11 wallpaper images
├── assets/
│   └── sound_effect/
│       ├── Victory_sound.mp3       # Win celebration
│       └── hover.mp3               # Button hover feedback
```

---

## Badge System Architecture

```
User Action → Stats Update → Badge Check → Unlock? → Notification → Profile Save
```

**How It Works:**

1. **User Action** - Win game, reach milestone, enter code
2. **Stats Tracking** - `updateProfileStats()` records the action
3. **Condition Check** - `checkAndUnlockBadges()` evaluates all badge requirements
4. **Unlock Process** - Badge added to profile if conditions met
5. **Notification Queue** - Popup scheduled for next page load
6. **Save** - Everything stored in localStorage
7. **Display** - User sees celebration notification!

---

## Key Functions

**For Developers:**

```javascript
// Badge System
badgesData.js
  - badgesList: Array of all badge definitions
  - eventCodes: Valid event code dictionary
  - isEventCodeValid(code): Validates timing
  - getBadgeById(id): Retrieves badge data

badgesManager.js
  - initBadgesSystem(): Initialize entire system
  - checkAndUnlockBadges(): Evaluate conditions
  - showBadgeNotification(): Display unlock popup
  - toggleBadgeSelection(): Manage user selection

// Profile & Stats
profileStats.js
  - updateProfileStats({ result, mode, timeSpent, attempts })
  - getDefaultProfile(): Create initial structure
  - getDefaultModeStats(): Initialize mode stats
```

---

## LocalStorage Schema

```javascript
{
  "personaUserProfile": {
    // Identity
    "username": "WildCard",
    "avatar": "Joker.jpg",
    "wallpaper": "Velvet_Room_Wallpaper.png",
    
    // Badges
    "badges": ["first_win", "ace_detective"],
    "selectedBadges": ["first_win", "ace_detective"],
    "pendingBadgeNotifications": [],
    "eventCodes": ["XMAS2025"],
    
    // Stats
    "stats": {
      "games": 42,
      "wins": 35,
      "giveups": 7,
      "streak": 5,
      "streakRecord": 12,
      "totalTimeMinutes": 180,
      "favoriteMode": "Classic",
      "modeCount": { "Classic": 20, ... }
    }
  }
}
```

---

## Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 90+ | Supported | Best performance |
| Firefox | 88+ | Supported | Full support |
| Safari | 14+ | Supported | iOS 14+ compatible |
| Edge | 90+ | Supported | Chromium-based |
| Opera | 76+ | Supported | Chromium-based |

**Requirements:**
- JavaScript enabled
- LocalStorage enabled
- 1280x720+ resolution recommended
- Internet connection for assets

---

\newpage

# Thank You!

This update wouldn't exist without our amazing community. Seriously - you all rock!

---

## Development Team

**Core Developers:**
- **Hamza** - Lead Developer, System Architecture, Badge System
- **L2GENDAIRE** - Data Management, Design, Content Creation

**Special Thanks:**
- Community beta testers for catching bugs
- Discord members for endless feedback and suggestions

---

## Community Contributors

### Content Creators

**Arati** ([@Arati](https://www.youtube.com/@Arati.))  
Huge shoutout for community support and featuring PersonaDLE! You earned your own badge for a reason.

### Resources & References

**Megami Tensei Wiki** ([Fandom](https://megamitensei.fandom.com/wiki/Megami_Tensei_Wiki))  
Essential resource for accurate character data, arcana information, and Persona lore. Couldn't have done it without you!

### Community Platforms

**Discord Community**  
You're the real MVPs - reporting bugs, suggesting features, testing updates, and making PersonaDLE better every day. Special thanks to:
- Bug reporters who helped us squash issues fast
- Feature suggestion contributors
- Beta testers who dealt with our broken builds
- Everyone who shares their profiles and achievements

**Reddit r/PERSoNA Community**  
Thanks for the feedback, suggestions, and support since day one!

---

## Assets & Legal

**Game Assets:**  
All Persona characters, music, portraits, and game elements are copyright Atlus / SEGA. Music composed by Shoji Meguro and team.

**Development Tools:**  
Visual Studio Code, Git/GitHub, Chrome DevTools, Figma

**Libraries:**  
Pure vanilla JavaScript (no frameworks!), LocalStorage API, Canvas API, CSS3

---

### Legal Notice

**PersonaDLE** is a **fan-made project** created out of love for the Persona series.  

**Not affiliated with, endorsed by, or connected to Atlus or SEGA** in any way.  

All Persona content is intellectual property of their respective copyright holders. This project is **non-commercial** and **non-profit**.

**If you enjoy PersonaDLE, please support the official Persona games by purchasing them from Atlus/SEGA!**

---

\newpage

# Final Words

Thank you for being part of the **PersonaDLE community**!

This update represents months of work, late nights, and a whole lot of passion for Persona. Whether you're hunting all 19 badges or just enjoying daily puzzles, we're glad you're here.

---

## What's Next?

- **Selectable Background Music** - Coming in a future update!  
- **More Badges** - New achievements and events planned  
- **More Life** - Additional sound effects, animations, and polish  
- **Your Ideas** - Keep the feedback coming!

---

## Stay Connected

- **Website:** [https://personadle.net/]  
- **Discord:** [https://discord.gg/wpMdGGDp3y]  
- **GitHub:** [https://github.com/HamzaKarrouchi/personadle]  

---

## Community Guidelines

**Be cool, be kind:**
- Help newcomers learn the ropes
- Share strategies and discoveries
- Report bugs constructively
- Celebrate each other's achievements
- Most importantly: **Have fun!**

---

The Persona series is about **bonds, growth, and facing your true self**. PersonaDLE aims to capture that spirit through daily challenges and community achievements.

**Thank you for playing, sharing, and being part of this journey.**

---

## Version History

**Version 1.0** - December 2025
- Badge System (19 badges)
- Profile Sharing with 11 wallpapers
- Sound Effects (victory & hover)
- New characters (Fuuka, Erina, Toshiro)
- All-Out Attack performance overhaul
- Major bug fixes
- Dark mode improvements
- New profile avatars

---

**— The PersonaDLE Team**

*"I am thou, thou art I... And together, we'll reach the truth."*

---

*Last updated: December 2025*  
*PersonaDLE is not affiliated with Atlus or SEGA.*  
*Made with love by fans, for fans.*