# TECHNISCHE DOCUMENTATIE - BetaGrade AI

## Samenvatting

BetaGrade AI is een intelligente applicatie die klim- en boulderroutes automatisch analyseert en gradeert met behulp van kunstmatige intelligentie. Het systeem maakt gebruik van Google's Gemini-model voor afbeeldingsanalyse en een PostgreSQL-database (Supabase) voor gegevenspersistentie. De applicatie biedt een feedback-mechanisme waardoor gebruikers geverifieerde grades kunnen invoeren, waardoor het AI-model voortdurend kan leren en verbeteren.

---

## 1. Architectuur Overzicht

Het systeem bestaat uit drie hoofdcomponenten:

### Frontend (React + TypeScript)
De frontendapplicatie is gebouwd met React 19 en biedt een gebruiksvriendelijk interface voor het uploaden van foto's en het weergeven van analyseresultaten. De applicatie maakt gebruik van Tailwind CSS voor styling en Framer Motion voor animaties.

### Backend API (Vercel Serverless)
Het backend wordt gehost op Vercel en bestaat uit serverloze functies die HTTP-verzoeken verwerken. De API biedt drie hoofdendpoints:
- GET `/api/routes` - Haalt alle geanalyseerde routes op
- POST `/api/routes` - Slaat nieuwe analyses op
- PATCH `/api/routes/{id}` - Werkt routes bij met geverifieerde grades

### AI Service (Google Gemini)
Het Gemini 2.0 Flash model van Google verwerkt de afbeeldingen en genereert analyseresultaten. Dit model is optimaal voor snelle afbeeldingsanalyse met hoge nauwkeurigheid.

### Database (Supabase)
Supabase fungeert als de backend-database en slaat alle analysegegevens op, inclusief afbeeldingen, geschatte grades, beschrijvingen en geverifieerde grades van gebruikers.

```
Gebruiker → Frontend (React) → API (Node.js) → Gemini AI
                ↓                                    ↓
            Afbeeldingen               Analyse + Grade
                ↓                                    ↓
            Supabase Database ← Geverifieerde Grades
```

---

## 2. AI-Analyseservice (geminiService.ts)

### 2.1 Gemini-client Initialisatie

```typescript
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
```

De API-sleutel wordt geladen uit omgevingsvariabelen. Dit volgt beveiligingsrichtlijnen door gevoelige gegevens uit broncode te houden. De `GoogleGenAI`-klasse biedt een interface naar het Gemini-model.

### 2.2 Afbeeldingscompressie en Resizing

```typescript
export async function resizeImage(base64Str: string, maxWidth = 1024, maxHeight = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Behoud aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
}
```

Afbeeldingscompressie is essentieel om twee redenen:

1. **API-limieten**: AI-providers hebben beperkingen op de grootte van verzoeken. Door afbeeldingen naar 1024x1024 pixels te schalen, voorkomen we timeouts.

2. **Latentie**: Kleinere afbeeldingen worden sneller verwerkt. Dit verbetert de gebruikerservaring aanzienlijk.

3. **Kwaliteitsbehoud**: Door JPEG 0.7 compressie te gebruiken, behouden we voldoende detail voor AI-analyse terwijl de bestandsgrootte drastisch afneemt.

De functie behoudt de aspect ratio, dus afbeeldingen worden niet vervormd. Dit is belangrijk omdat vervorming de nauwkeurigheid van de analyse zou kunnen schaden.

### 2.3 Prompt Engineering

```typescript
const prompt = `
  You are an expert bouldering route setter and grade estimator with a universal perspective. 
  I am providing 3 different angles of a bouldering route.
  Extra context from the user: ${extraInfo}
  ${trainingContext}

  CRITICAL INSTRUCTIONS:
  1. IGNORE HOLD COLORS for difficulty estimation. Many gyms use color-coded circuits, but these are arbitrary and not universal.
  2. FOCUS ON PHYSICALITY: Analyze hold geometry (crimps, slopers, jugs, pockets), wall inclination, distance between holds, and technical complexity.
  3. UNIVERSAL STANDARDS: Use the French Font bouldering grade system as a universal standard.
  4. LEARNING FROM EXAMPLES: Use the provided examples to understand how physical features translate to specific grades.
  
  Provide:
  1. A French Font bouldering grade range of exactly 2 adjacent grades (e.g., "6A-6A+" or "7B+-7C").
  2. A short description of exactly 5 small sentences describing the route's character based ONLY on its physical features.

  Return the response in JSON format.
`;
```

**Prompt engineering** is de kunst van het formuleren van instructies zodat een AI-model optimale resultaten levert. Deze prompt omvat:

- **Roldefiniëring**: Het model wordt verteld dat het een expert route-setter is, wat het aanwijzingen geeft voor hoe het moet redeneren.

- **Expliciete waarschuwingen**: "IGNORE HOLD COLORS" is cruciaal. Veel indoor klimzalen gebruiken kleurgecodeerde circuits waar de kleur niets met de moeilijkheidsgraad te maken heeft. Zonder deze waarschuwing zou het model gespeeld worden.

- **Instructies voor structuur**: Het model wordt verteld dat het exact 2 aangrenzende grades moet geven (bijv. "6A-6A+"). Dit elimineert ambiguïteit in het antwoord.

- **Trainingsgegevens integratie**: De prompt bevat voorbeelden van eerder geverifieerde routes zodat het model van deze voorbeelden kan leren.

- **Output-format**: Door `"Return the response in JSON format"` op te geven, kunnen we het antwoord gemakkelijk parseren.

### 2.4 Trainingsgegevensintegratie

```typescript
let trainingContext = "";
if (trainingData.length > 0) {
  trainingContext = "\n\nHere are some examples of verified routes to help you calibrate your universal grading logic:\n";
  trainingData.forEach((ex, i) => {
    trainingContext += `Example ${i+1}:
- User Context: ${ex.extra_info || 'None'}
- AI Estimated: ${ex.grade_range}
- Verified Grade (Ground Truth): ${ex.official_grade || ex.grade_range}
- Physical Description: ${ex.description}
---\n`;
  });
}
```

Dit onderdeel implementeert **few-shot learning**, een techniek waarbij het model wordt getraind op een klein aantal voorbeelden. In plaats van formeel model fine-tuning, geven we het model voorbeelden in de prompt:

- **Wat het AI-model schatte**: De initiële voorspelling
- **Wat het werkelijk was**: De geverifieerde grade van een expert
- **De fysieke beschrijving**: Details die helpen het model te begrijpen waarom die grade correct was

Dit creëert een leerloop waarin het model progressief nauwkeuriger wordt naarmate meer gebruikers feedback geven.

### 2.5 AI-Aanroep en Response-Schema

```typescript
const response = await ai.models.generateContent({
  model,
  contents: {
    parts: [...imageParts, { text: prompt }],
  },
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        gradeRange: {
          type: Type.STRING,
          description: "French Font grade range, e.g., 6A-6A+",
        },
        description: {
          type: Type.STRING,
          description: "Exactly 5 small sentences describing the route.",
        },
      },
      required: ["gradeRange", "description"],
    },
  },
});
```

De `responseSchema` garandeert dat het AI-model alleen in het verwachte format antwoordt. Dit is belangrijk omdat:

1. **Validatie**: Als het model niet beide velden levert, wordt het verzoek afgewezen.
2. **Parsering**: We weten exact welke velden we gaan ontvangen, dus parsing is triviaal.
3. **Foutafhandeling**: Onverwachte responses kunnen onmiddellijk worden gedetecteerd.

De response wordt als JSON geparseerd:
```typescript
const resultText = response.text;
if (!resultText) {
  throw new Error("No text response from Gemini");
}
return JSON.parse(resultText);
```

---

## 3. Backend API-ontwerp (api/routes.ts)

### 3.1 GET-endpoint: Routes ophalen

```typescript
if (req.method === "GET") {
  try {
    const { data, error } = await getSupabase()
      .from("routes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch routes" });
      return;
    }
    res.status(200).json(data);
  } catch (err: any) {
    console.error("GET /routes error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
  return;
}
```

Dit endpoint haalt alle geanalyseerde routes op uit de database. De `.order("created_at", { ascending: false })` zorgt ervoor dat de nieuwste routes eerst worden weergegeven. Het antwoord bevat alle gerelateerde gegevens: afbeeldingen, grades, beschrijvingen en geverifieerde grades.

**Foutafhandeling**: Als de database onbereikbaar is, wordt een 500-fout geretourneerd met een beschrijvend bericht.

### 3.2 POST-endpoint: Nieuwe analyse opslaan

```typescript
if (req.method === "POST") {
  try {
    const {
      image1, image2, image3,
      extra_info,
      grade_range,
      description,
      official_grade,
      is_verified,
    } = req.body;
    
    const { data, error } = await getSupabase()
      .from("routes")
      .insert({
        image1, image2, image3,
        extra_info,
        grade_range,
        description,
        official_grade: official_grade || null,
        is_verified: is_verified ? 1 : 0,
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("Insert error:", error);
      res.status(500).json({ error: error.message || "Failed to save route" });
      return;
    }
    res.status(200).json({ id: data.id });
  }
}
```

Dit endpoint slaat een nieuwe AI-analyse op in de database. Opvallende punten:

- **Destructuring**: De vereiste velden worden geëxtraheerd uit het request body
- **Null-handling**: `official_grade: official_grade || null` - Als de gebruiker geen geverifieerde grade levert, wordt `null` opgeslagen
- **Boolean-conversie**: `is_verified: is_verified ? 1 : 0` - PostgreSQL boolean waarden worden als 0/1 opgeslagen
- **ID-retournering**: `.select("id").single()` geeft het zojuist gemaakte record-ID terug, dat later wordt gebruikt voor feedback

Dit ID is cruciaal want het stelt gebruikers in staat later een geverifieerde grade in te voeren.

### 3.3 PATCH-endpoint: Geverifieerde Grade toevoegen

```typescript
if (req.method === "PATCH" && id) {
  try {
    const { official_grade } = req.body;
    const { error } = await getSupabase()
      .from("routes")
      .update({ official_grade })
      .eq("id", id);
    if (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: error.message || "Failed to update grade" });
      return;
    }
    res.status(200).json({ success: true });
  }
}
```

Dit endpoint implementeert de **feedback-lus**. Wanneer een gebruiker een geverifieerde grade invoert:

1. Het verzoek bevat het route-ID en de geverifieerde grade
2. De database wordt bijgewerkt met deze grade
3. Dit wordt onmiddellijk beschikbaar gemaakt aan het AI-model als trainingsgegevens
4. Volgende analyses leren van deze feedback

Dit is het hart van het continue leerproces.

### 3.4 URL-parsing voor ID-extractie

```typescript
const url: string = req.url || "";
const idMatch = url.match(/\/api\/routes\/(\d+)/);
const id = idMatch ? idMatch[1] : null;
```

Dit extraheert de route-ID uit URLs zoals `/api/routes/123`. De regex `/\/api\/routes\/(\d+)/` zoekt naar het patroon en slaat alleen het getal (ID) op.

---

## 4. Frontend-integratie (App.tsx)

### 4.1 Afbeelding Upload Handler

```typescript
const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  Array.from(files as FileList).forEach((file: File) => {
    if (images.length >= 3) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImages(prev => [...prev, reader.result as string].slice(0, 3));
    };
    reader.readAsDataURL(file);
  });
};
```

Dit onderdeel verwerkt afbeelding uploads:

- **FileReader**: Leest lokale bestanden en converteert ze naar base64-gecodeerde strings
- **Limiet van 3**: `.slice(0, 3)` garandeert dat we nooit meer dan 3 afbeeldingen hebben
- **Asynchrone verwerking**: `reader.onloadend()` wordt aangeroepen wanneer de conversie voltooid is

Base64-codering is nodig omdat we afbeeldingen als JSON moeten verzenden naar de API.

### 4.2 Analysewerk stroom

```typescript
const startAnalysis = async () => {
  if (images.length < 3) return;
  setIsAnalyzing(true);
  try {
    // Stap 1: AI-analyse aanroepen
    const analysis = await analyzeBoulderingRoute(images, extraInfo, trainingData);
    setResult(analysis);
    
    // Stap 2: Afbeeldingen comprimeren voor opslag
    const resizedForDb = await Promise.all(images.map(img => resizeImage(img, 800, 800)));

    // Stap 3: Naar database opslaan
    const res = await fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image1: resizedForDb[0],
        image2: resizedForDb[1],
        image3: resizedForDb[2],
        extra_info: extraInfo,
        grade_range: analysis.gradeRange,
        description: analysis.description
      })
    });
    
    // Stap 4: Database-ID opslaan voor feedback
    if (res.ok) {
      const saved = await res.json();
      setLastAnalyzedId(saved.id);
    }

    // Stap 5: UI bijwerken
    fetchHistory();
    setView('results');
  } catch (err: any) {
    console.error('Analysis failed', err);
    alert(err.message || 'Failed to analyze route. Please try again.');
  } finally {
    setIsAnalyzing(false);
  }
};
```

Dit is de centrale werkstroom:

1. **Validatie**: Zorg dat minimaal 3 afbeeldingen zijn geüpload
2. **AI-analyse**: Roep Gemini aan met afbeeldingen + trainingsgegevens
3. **Compressie**: Resize afbeeldingen naar 800x800 pixels voor databaseopslag
4. **Opslag**: Stuur alles naar het backend API
5. **ID-behoud**: Sla het database-ID op zodat gebruikers feedback kunnen geven
6. **UI-update**: Vernieuw de geschiedenis en toon resultaten

### 4.3 Feedback-indiening (Learning Loop)

```typescript
const submitOfficialGrade = async () => {
  if (!lastAnalyzedId || !officialGradeInput) return;
  setIsSubmittingFeedback(true);
  try {
    // Stuur geverifieerde grade naar server
    await fetch(`/api/routes/${lastAnalyzedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ official_grade: officialGradeInput })
    });
    
    // Vernieuw trainingsgegevens zodat AI van dit voorbeeld leert
    fetchHistory();
    fetchTrainingData();
    
    alert('Thank you! This grade will help the AI learn for future analyses.');
  } catch (err) {
    console.error('Failed to submit feedback:', err);
  } finally {
    setIsSubmittingFeedback(false);
  }
};
```

Dit implementeert het feedback-mechanisme:

1. **Geverifieerde Grade**: Gebruiker voert de echte grade in (bijv. van TopLogger)
2. **Database-update**: Dit wordt via PATCH naar de server gestuurd
3. **Trainingsgegevens Vernieuwen**: `fetchTrainingData()` haalt nu dit nieuwe voorbeeld op
4. **AI Leert**: Volgende analyses zullen dit voorbeeld gebruiken om nauwkeuriger te worden

---

## 5. Machine Learning Door Feedback

Het systeem implementeert een **voortdurende leerloop**:

```
Gebruiker analyseert route
        ↓
AI geeft schatting (bijv. 6A)
        ↓
Gebruiker voert geverifieerde grade in (bijv. 6B+)
        ↓
Database wordt bijgewerkt
        ↓
Trainingsgegevens worden vernieuwd
        ↓
Volgende analyse leert van dit voorbeeld
        ↓
AI wordt nauwkeuriger
```

Dit is geen traditioneel machine learning (met model retraining), maar eerder **in-context learning**. Door trainingsvoorbeelden in de prompt op te nemen, leert het model:

- Welke fysieke kenmerken naar welke grades leiden
- Hoe universele grading scale moet worden toegepast
- Welke fouten het eerder maakte en hoe die te vermijden

Dit proces verbetert voortdurend zonder server-side retraining.

---

## 6. Technische Uitdagingen & Oplossingen

### 6.1 Afbeeldings payload grootte
**Probleem**: Grote afbeeldingen overschrijden API-limieten
**Oplossing**: Implementeer `resizeImage()` functie met adaptieve compressie

### 6.2 Row-Level Security (RLS) in Supabase
**Probleem**: Anonieme gebruikers konden niet naar database schrijven
**Oplossing**: Configureer RLS-policies om anonieme INSERT/SELECT/UPDATE toe te staan

### 6.3 Inconsistente AI-resultaten
**Probleem**: AI gaf verschillende grades voor vergelijkbare routes
**Oplossing**: Voeg trainingsgegevens toe aan prompt zodat model leert van voorbeelden

### 6.4 Afbeelding kleur als valse indicator
**Probleem**: Indoor klimzalen gebruiken kleurcodes die niet met moeilijkheid te maken hebben
**Oplossing**: Voeg expliciete waarschuwing in prompt: "IGNORE HOLD COLORS"

---

## 7. Conclusie

BetaGrade AI demonstreert hoe modern AI kan worden geïntegreerd in praktische applicaties. De architectuur combineert:

- **Frontend-eenvoud**: React biedt een intuïtieve UI
- **AI-geavanceerdheid**: Gemini verwerkt complexe visuele informatie
- **Databasepersistentie**: Supabase slaat trainingsgegevens op
- **Voortdurend leren**: Feedback-mechanisme verbetert nauwkeurigheid over tijd

De sleutel tot het succes is de combinatie van:
1. **Goed prompt engineering** (expliciete instructies)
2. **Trainingsgegevens integration** (few-shot learning)
3. **Feedback-mechanisme** (voortdurend verbeteren)
4. **Robuuste error handling** (betrouwbare werking)

Dit project toont aan dat AI niet alleen gaat om ingewikkelde algoritmes, maar ook over het ontwerpen van systemen die effectief gebruikersfeedback kunnen gebruiken om voortdurend te verbeteren.
