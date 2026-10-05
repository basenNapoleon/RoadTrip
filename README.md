# Roadtrip – appen

En delad webbapp för dig och dina reskamrater: rutt & stopp på en karta, röstning, packlista och utgiftsdelning. Allt uppdateras live för alla.

Funkar på alla telefoner (iPhone och Android) direkt i webbläsaren – ingen installation.

## Så här kommer den igång (ca 10 minuter, görs en gång av dig)

### 1. Skapa ett gratis Firebase-projekt
1. Gå till https://console.firebase.google.com och logga in med ett Google-konto.
2. Klicka **"Lägg till projekt"**, ge det ett namn (t.ex. `roadtrip-2027`), skapa projektet.
3. I projektet: klicka på webb-ikonen (`</>`) för att lägga till en webbapp. Ge den ett namn, du behöver inte kryssa i Firebase Hosting.
4. Du får upp ett kodblock som ser ut ungefär så här:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "roadtrip-2027.firebaseapp.com",
     projectId: "roadtrip-2027",
     storageBucket: "roadtrip-2027.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Öppna filen **`firebase-config.js`** i den här mappen och klistra in dina egna värden istället för `"FYLL_I_..."`.

### 2. Aktivera databasen (Firestore)
1. I Firebase-menyn till vänster: gå till **Build → Firestore Database**.
2. Klicka **"Create database"**.
3. Välj **"Start in test mode"** (räcker gott för en resa på några veckor).
4. Välj en region i Europa (t.ex. `eur3`).
5. Gå till fliken **Rules** i Firestore och klistra in detta, klicka sedan **Publish**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /trips/{tripId} {
         allow read, write: if true;
       }
     }
   }
   ```
   Detta gör att vem som helst med er hemliga resekod kan läsa/skriva – helt okej för en privat vänresa, men dela **inte** koden offentligt.

### 3. Publicera appen så alla kan öppna den
Enklaste sättet – ingen installation krävs:
1. Gå till https://app.netlify.com/drop (eller vercel.com/drop)
2. Dra hela den här mappen till sidan.
3. Du får en publik länk direkt, typ `https://random-namn-123.netlify.app`.
4. Skicka länken till dina reskamrater.

### 4. Kom igång
1. Alla öppnar länken.
2. Alla skriver in **exakt samma resekod** (hitta på valfri, t.ex. `sommar-gang-2027`) och sitt eget namn.
3. Klart – allt ni lägger till syns live hos alla.

Tips: lägg till appen på hemskärmen (Dela → Lägg till på hemskärmen på iPhone, eller Meny → Lägg till på startskärmen på Android) så känns det som en riktig app.

## Funktioner
- **Rutt**: sök en plats eller klicka på kartan för att lägga till stopp, med automatisk beräkning av total körsträcka och körtid. Skriv t.ex. "sover här" i anteckningen på ett stopp.
- **Rösta**: skapa omröstningar när ni behöver bestämma något tillsammans (leder, aktiviteter, vad som helst), se resultat live.
- **Packa**: en gemensam packlista (kan tilldelas en person) och en personlig packlista per medlem.
- **Utgifter**: registrera utlägg, appen räknar automatiskt ut vem som är skyldig vem.
- Appen fungerar även offline (visar senast synkade data och synkar dina ändringar när du är uppkopplad igen).

## Om ni vill bygga vidare
Koden är enkel vanilla HTML/CSS/JS + Firebase, inga byggverktyg krävs. All logik finns i `app.js`, all styling i `style.css`.
