# PERSONADLE

<p align="center">
  <img src="./img/Logo_PersonaDLE.png" alt="Personadle Logo" width="700">
</p>

**A daily guessing game set in the Persona universe.**  
Inspired by [Smashdle](https://smashdle.net), Personadle brings a stylish twist from Persona 1 to Persona 5X.

Each day, guess a new character using visual, textual, or symbolic clues—depending on the mode you choose.  
Whether you're a long-time fan or new to the series, there's something for everyone.

---

## 🧠 Concept

**Personadle** is a free, fan-made browser game celebrating the world of Persona.  
Your goal: **identify the daily character** based on clues tailored to each mode—silhouettes, quotes, personas, emojis, and more.

It's designed for daily play, with your progress saved locally and a UI inspired by the Persona aesthetic.

---

## 🎮 Game Modes

1. **Classic Mode**  
   Compare character traits—Arcana, gender, age, game, Persona, etc.—with color-coded feedback. Each guess brings you closer to the target.

2. **Emoji Mode**  
   A series of emojis gradually appears. Use logic (and a bit of chaos) to link them to a character. The longer you wait, the weirder it gets.

3. **All-Out Attack Mode**  
   A blurred battle animation is revealed step by step. Spot the pose, the costume, or the attack pattern to find who's behind it.

4. **Shadow Mode**  
   A dark silhouette zooms out with each wrong guess. No blur—just outlines and your memory.

5. **Personae Mode**  
   You're shown a Persona. Can you guess who uses it? A challenge for Velvet Room veterans and lore lovers.

6. **Music Mode**  
   A short music clip plays. Identify the character or the theme. From overworld tracks to boss music—only true fans will know.

---

### All modes include:

- Smart autocompletion with character portraits  
- Filter persistence between sessions  
- Unique mechanics per mode  
- Custom animations and reveal systems  

---

## 🚀 How to Play

No installation needed—just open the game in your browser.

- Play once per day (auto-resets at midnight, Paris time)
- Use the **Replay** button to restart as many times as you'd like
- Use the **Give Up** button if you're stuck and want the answer
- Your progress and stats are saved locally
- You can export or import your data as a JSON file

All data is stored in your browser using `localStorage`. Nothing is uploaded online.

---

## ✨ Features

- Persona 5-inspired UI with SVG effects and dynamic transitions
- Daily reset system synced to Paris time
- Persistent game filters (P1 to P5X) across sessions
- Keyboard-friendly autocompletion with thumbnails
- Fully responsive across devices
- Dark mode enabled by default
- Optional colorblind-friendly symbols
- Local player profile:
  - Custom pseudonym & avatar (with cropping)
  - Stats: wins, give-ups, streaks, favorite mode
  - Export/import/reset via JSON
- Per-mode session tracking with anti-duplicate logging

---

## 📊 Profile Overview

Each player has a local profile with:

- Editable pseudonym  
- Custom avatar (upload + crop)  
- Tracked wins, give-ups, streaks  
- Favorite mode (based on time spent)  
- Daily playtime tracker  
- Full data control: export, import, reset  

Everything is saved privately in your browser only.

---

## 🛠️ Tech Stack

Built entirely with vanilla web technologies — fast, lightweight, and dependency-free:

- **HTML5** — semantic markup and accessible structure  
- **CSS3** — custom animations, responsive design, dark mode  
- **JavaScript (ES6+)** — modular logic, localStorage, dynamic UI  

No frameworks, no external libraries, no backend.

---

## 🚧 Roadmap

| Feature                            | Status     |
|------------------------------------|------------|
| All 6 Game Modes                   | ✅ Done     |
| Local Profiles & Stats             | ✅ Done     |
| Colorblind Mode                    | ✅ Done     |
| Daily Reset System                 | ✅ Done     |
| Mobile UI Support                  | ✅ Done     |
| Full Responsive Layout             | 🔜 Planned  |
| Filter Persistence                 | ✅ Done     |
| Persona-style SVG UI               | ✅ Done     |
| Online Leaderboards                | 🔜 Planned  |
| Shareable Streak History / Stats  | 🔜 Planned  |
| Website Deployment (GitHub Pages) | 🔜 Planned  |

---

## 🏅 Coming Soon

### Achievements & Badges

Unlockable milestones based on your gameplay.  
Examples: “First Try!”, “7-Win Streak”, “P4 Expert”  
Badges will show up in your profile.

### Audio Customization

Unlock Persona music to set as background audio.  
Could play in menus or during gameplay.

### Profile Backgrounds

Choose a visual background based on your favorite game or achievements.  
From soft gradients to dynamic effects.

### Mobile App / PWA

Make Personadle installable as a Progressive Web App.  
Offline play and quick access with a custom icon.

### Multi-language Support (EN / FR / JP)

To make the game more accessible for Persona fans around the world.

---

## 👤 Authors

### **Hamza** – Lead Developer  
Game logic, animations, UI, profile system  
Computer science student and Persona/JoJo enjoyer

### **Léo** – Data & Design  
Character database, layout balancing, portraits  
Spreadsheet wizard and UI enthusiast

---

## 🖼️ Screenshots

### Classic Mode  
![Classic](./img/preview/preview_classic.png)  
![Classic Victory](./img/preview/preview_classic_victory.png)

### Emoji Mode  
![Emoji](./img/preview/preview_emoji.png)

### All-Out Attack Mode  
![All-Out Attack](./img/preview/preview_all_out_attack.png)  
![All-Out Victory](./img/preview/preview_all_out_attack_victory.png)

### Shadow Mode  
![Shadow](./img/preview/preview_shadow.png)

### Personae Mode  
![Personae](./img/preview/preview_personae.png)

### Music Mode  
![Music](./img/preview/preview_music.png)

---

## 🛡️ License

This project is under the [MIT License](./LICENSE.txt).  
You’re free to use, modify, and share the code for non-commercial use — just credit the authors and keep it stylish.

---

## ⚠️ Disclaimer

**Personadle is a fan-made project** and is not affiliated with ATLUS, SEGA, or the Persona franchise.

All characters, music, and references remain the property of their respective rights holders.  
No copyrighted assets are used — all visuals and audio are minimal recreations for educational and entertainment purposes.

---

## 🙌 Thanks & Credits

- Inspired by **[Smashdle](https://smashdle.net/)** by *Pimeko*  
- Codebase inspired by [Pokedle](https://github.com/maxm33/pokedle)  
- Huge thanks to ATLUS and SEGA for creating the Persona universe

Let’s make every day a Metaverse mission.
