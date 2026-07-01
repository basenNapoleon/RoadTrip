# Lofoten Roadtrip – appen

En delad webbapp för dig och dina tre vänner: rutt & stopp på en karta, boende/dag-för-dag-schema, röstning, vandrings-/aktivitetsidéer, packlista och utgiftsdelning. Allt uppdateras live för alla fyra.

Funkar på alla telefoner (iPhone och Android) direkt i webbläsaren – ingen installation.

## Så här kommer den igång (ca 10 minuter, görs en gång av dig)

### 1. Skapa ett gratis Firebase-projekt
1. Gå till https://console.firebase.google.com och logga in med ett Google-konto.
2. Klicka **"Lägg till projekt"**, ge det ett namn (t.ex. `lofoten-2026`), skapa projektet.
3. I projektet: klicka på webb-ikonen (`</>`) för att lägga till en webbapp. Ge den ett namn, du behöver inte kryssa i Firebase Hosting.
4. Du får upp ett kodblock som ser ut ungefär så här:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "lofoten-2026.firebaseapp.com",
     projectId: "lofoten-2026",
     storageBucket: "lofoten-2026.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Öppna filen **`firebase-config.js`** i den här mappen och klistra in dina egna värden istället för `"FYLL_I_..."`.

### 2. Aktivera bilduppladdning (Cloudinary, valfritt men rekommenderat)
Behövs bara om ni vill kunna ladda upp bilder direkt i appen (annars funkar allt annat ändå).
1. Gå till https://cloudinary.com och skapa ett gratis konto (mejl, Google eller GitHub räcker, inget kreditkort krävs).
2. På Dashboard-sidan, kopiera ditt **"Cloud name"** högst upp.
3. Gå till inställningar (kugghjulet uppe till höger) → **Upload** → **Upload presets** → **Add upload preset**.
4. Sätt **Signing Mode** till **Unsigned**, spara, och kopiera namnet på presetet.
5. Öppna **`cloudinary-config.js`** i den här mappen och klistra in `cloudName` och `uploadPreset`.

Gratisnivån ger 25 krediter/månad (1 kredit ≈ 1 GB lagring eller bandbredd) – gott och väl för en resas bilder, och ni blir aldrig debiterade eftersom kontot inte har något kort kopplat.

### 3. Aktivera databasen (Firestore)
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

### 4. Publicera appen så alla kan öppna den
Enklaste sättet – ingen installation krävs:
1. Gå till https://app.netlify.com/drop (eller vercel.com/drop)
2. Dra hela den här mappen till sidan.
3. Du får en publik länk direkt, typ `https://random-namn-123.netlify.app`.
4. Skicka länken till dina tre vänner.

### 5. Kom igång
1. Alla fyra öppnar länken.
2. Alla skriver in **exakt samma resekod** (hitta på valfri, t.ex. `lofoten-gang-2026`) och sitt eget namn.
3. Klart – allt ni lägger till syns live hos alla.

Tips: lägg till appen på hemskärmen (Dela → Lägg till på hemskärmen på iPhone, eller Meny → Lägg till på startskärmen på Android) så känns det som en riktig app.

## Funktioner
- **Rutt**: sök en plats eller klicka på kartan för att lägga till stopp på vägen upp, med automatisk beräkning av total körsträcka och körtid, plus ett körschema för vem som kör vilken dag.
- **Boende**: lägg till varje natt med datum, plats och anteckning/länk, samt ett delat fotogalleri.
- **Rösta**: skapa omröstningar när ni behöver bestämma något tillsammans, se resultat live.
- **Vandring**: dela idéer på leder/aktiviteter i Lofoten, gilla-markera favoriter.
- **Packa**: en gemensam packlista (kan tilldelas en person) och en personlig packlista per medlem.
- **Utgifter**: registrera utlägg, appen räknar automatiskt ut vem som är skyldig vem.
- Appen fungerar även offline (visar senast synkade data och synkar dina ändringar när du är uppkopplad igen).

## Om ni vill bygga vidare
Koden är enkel vanilla HTML/CSS/JS + Firebase, inga byggverktyg krävs. All logik finns i `app.js`, all styling i `style.css`.
