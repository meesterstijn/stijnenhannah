export default function Tips() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inspiratie</p>
        <h1 className="font-serif text-4xl font-semibold mt-2">Tips & Ideeën</h1>
        <p className="text-muted-foreground mt-2">
          Functies en ideeën die de tuinpagina nog mooier kunnen maken.
        </p>
      </header>

      <Section emoji="🌿" title="Dashboard">
        <p className="text-sm text-muted-foreground">De startpagina laat direct het belangrijkste zien:</p>
        <ul className="mt-2 space-y-1">
          {[
            "🌦 Weer",
            "💧 Welke planten water nodig hebben",
            "🌿 Bemesten",
            "✂️ Snoeien",
            "🍅 Oogsten",
            "🌸 Bloeiende planten",
            "📷 Recente foto's",
            "📈 Groei-overzicht",
          ].map((item) => (
            <li key={item} className="text-sm flex items-start gap-2">
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section emoji="🌱" title="Plantenbibliotheek">
        <p className="text-sm text-muted-foreground mb-3">Iedere plant heeft zijn eigen pagina. Bijvoorbeeld 🍅 Tomaat:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {["Foto", "Nederlandse naam", "Latijnse naam", "Water", "Zon", "Potmaat", "Oogst", "Snoeien", "Bemesten", "Ziektes", "Plagen", "Leuk weetje", "Kalender", "Persoonlijk logboek"].map((item) => (
            <span key={item} className="text-xs bg-muted rounded-lg px-2 py-1.5 text-muted-foreground">{item}</span>
          ))}
        </div>
      </Section>

      <Section emoji="🩺" title="Plantendokter">
        <p className="text-sm text-muted-foreground mb-4">De gebruiker kiest symptomen en krijgt een diagnose met mogelijke oorzaken.</p>

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Bladeren worden…</p>
            <div className="flex flex-wrap gap-1.5">
              {["geel", "bruin", "zwart", "wit", "paars", "vlekken", "krullen", "slap", "vallen af"].map((s) => (
                <span key={s} className="text-xs border border-border rounded-full px-2.5 py-1 text-foreground">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Vruchten…</p>
            <div className="flex flex-wrap gap-1.5">
              {["vallen af", "rotten", "blijven klein", "barsten", "kleuren niet"].map((s) => (
                <span key={s} className="text-xs border border-border rounded-full px-2.5 py-1 text-foreground">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Groei…</p>
            <div className="flex flex-wrap gap-1.5">
              {["groeit niet", "groeit langzaam", "bloeit niet", "maakt geen vruchten"].map((s) => (
                <span key={s} className="text-xs border border-border rounded-full px-2.5 py-1 text-foreground">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Wortels…</p>
            <div className="flex flex-wrap gap-1.5">
              {["rotten", "stinken", "groeien uit de pot"].map((s) => (
                <span key={s} className="text-xs border border-border rounded-full px-2.5 py-1 text-foreground">{s}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Voorbeeld resultaat — 🍃 Gele bladeren</p>
          {[
            { stars: 5, title: "Overbewatering", symptoms: ["hele plant geel", "grond erg nat", "slap blad"], fix: ["minder water", "betere drainage", "controleer wortelrot"] },
            { stars: 4, title: "Stikstoftekort", symptoms: ["oude bladeren geel", "nieuwe bladeren groen"], fix: ["moestuinvoeding geven"] },
            { stars: 4, title: "IJzertekort", symptoms: ["jonge bladeren geel", "nerven blijven groen"], fix: ["ijzermest", "pH controleren"] },
            { stars: 3, title: "Te kleine pot", symptoms: [], fix: [] },
            { stars: 2, title: "Vorstschade", symptoms: [], fix: [] },
            { stars: 2, title: "Ziekte", symptoms: [], fix: [] },
          ].map((d) => (
            <div key={d.title} className="rounded-xl border border-border/60 bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400">{"★".repeat(d.stars)}{"☆".repeat(5 - d.stars)}</span>
                <p className="font-medium text-sm">{d.title}</p>
              </div>
              {d.symptoms.length > 0 && (
                <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground/60 mb-0.5">Symptomen</p>
                    {d.symptoms.map((s) => <p key={s}>· {s}</p>)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground/60 mb-0.5">Oplossing</p>
                    {d.fix.map((s) => <p key={s}>· {s}</p>)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Andere diagnoses</p>
          {[
            { title: "Bruine bladeren", causes: ["te droog", "zonnebrand", "teveel mest", "wortelschade", "ouderdom"] },
            { title: "Slappe bladeren", causes: ["droogte", "overbewatering", "hitte", "wortelschade"] },
            { title: "Paarse bladeren", causes: ["fosfortekort", "kou"] },
            { title: "Witte aanslag", causes: ["meeldauw", "kalk", "spint"] },
            { title: "Gaten in blad", causes: ["slakken", "rupsen", "kevers"] },
          ].map((d) => (
            <div key={d.title} className="rounded-xl border border-border/60 bg-card px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-sm font-medium shrink-0">{d.title}</p>
              <p className="text-xs text-muted-foreground">{d.causes.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="🪲" title="Plagenbibliotheek">
        <p className="text-sm text-muted-foreground mb-3">Per plaag een volledige pagina. Bijvoorbeeld <strong>Bladluis</strong>:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {["Foto's", "Herkennen", "Levenscyclus", "Schade", "Voorkomen", "Lieveheersbeestjes inzetten", "Groene zeep", "Chemische bestrijding", "Wanneer ingrijpen"].map((item) => (
            <span key={item} className="text-xs bg-muted rounded-lg px-2 py-1.5 text-muted-foreground">{item}</span>
          ))}
        </div>
      </Section>

      <Section emoji="🦠" title="Ziektebibliotheek">
        <p className="text-sm text-muted-foreground mb-3">Per ziekte: foto, oorzaak, herkennen, behandeling, preventie.</p>
        <div className="flex flex-wrap gap-2">
          {["Meeldauw", "Botrytis", "Phytophthora", "Wortelrot", "Roest", "Bladvlekkenziekte"].map((z) => (
            <span key={z} className="text-xs border border-border rounded-full px-3 py-1">{z}</span>
          ))}
        </div>
      </Section>

      <Section emoji="📖" title="Tuinencyclopedie">
        <p className="text-sm text-muted-foreground mb-3">Wikipedia voor tuinieren — geen korte uitleg, maar echt alles.</p>
        <div className="space-y-3">
          {[
            { topic: "Water geven", items: ["waarom planten water nodig hebben", "capillaire werking", "regenwater vs kraanwater", "hard water", "bodemvocht", "van onder water geven", "wanneer juist niet"] },
            { topic: "Zon", items: ["ochtendzon", "middagzon", "avondzon", "UV", "kas", "ramen", "binnen"] },
            { topic: "Grond", items: ["potgrond", "compost", "humus", "kokos", "turf", "perliet", "vermiculiet", "klei", "zand", "drainage", "pH"] },
            { topic: "Bemesten", items: ["NPK", "Stikstof", "Fosfor", "Kalium", "Magnesium", "Calcium", "Spoorelementen", "Organisch vs mineraal", "Wanneer en hoeveel"] },
            { topic: "Snoeien", items: ["per planttype"] },
            { topic: "Verpotten", items: ["wanneer", "waarom", "hoe", "potmaat kiezen"] },
          ].map((t) => (
            <div key={t.topic} className="rounded-xl border border-border/60 bg-card px-4 py-3">
              <p className="font-medium text-sm">{t.topic}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.items.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="📅" title="Tuinkalender">
        <p className="text-sm text-muted-foreground mb-3">Per maand een overzicht. Bijvoorbeeld Juli:</p>
        <div className="grid grid-cols-2 gap-2">
          {["Wat zaaien", "Wat oogsten", "Wat snoeien", "Welke plagen zijn nu actief", "Welke bloemen bloeien"].map((item) => (
            <span key={item} className="text-xs bg-muted rounded-lg px-2 py-1.5 text-muted-foreground">{item}</span>
          ))}
        </div>
      </Section>

      <Section emoji="🌦" title="Weercentrum">
        <p className="text-sm text-muted-foreground mb-3">Combineer weer met tuinadvies:</p>
        <div className="space-y-2">
          {[
            { label: "Morgen 31°", advice: "💧 Geef vanavond water." },
            { label: "Komende nacht 8°", advice: "⚠ Zet citrus naar binnen." },
            { label: "Veel regen", advice: "⚠ Geef vandaag geen water." },
          ].map((w) => (
            <div key={w.label} className="rounded-xl border border-border/60 bg-card px-4 py-2.5 flex items-baseline gap-3">
              <p className="text-sm font-medium shrink-0">{w.label}</p>
              <p className="text-sm text-muted-foreground">{w.advice}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="📷" title="Groeilogboek">
        <p className="text-sm text-muted-foreground mb-3">Per plant foto's toevoegen met hoogte, bloemen, vruchten en notities. Automatisch een tijdlijn.</p>
        <div className="space-y-2">
          {[
            { date: "12 mei", detail: "📷 · 45 cm · 2 bloemen" },
            { date: "18 mei", detail: "📷 · 55 cm · eerste paprika" },
            { date: "25 mei", detail: "📷 · eerste oogst" },
          ].map((e) => (
            <div key={e.date} className="rounded-xl border border-border/60 bg-card px-4 py-2.5 flex items-baseline gap-3">
              <p className="text-xs text-muted-foreground shrink-0 w-16">{e.date}</p>
              <p className="text-sm">{e.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="❤️" title="Mijn tuin">
        <p className="text-sm text-muted-foreground mb-3">Gebruiker selecteert zijn eigen planten en krijgt alleen tips daarvoor.</p>
        <div className="flex flex-wrap gap-2">
          {["☑ tomaat", "☑ paprika", "☑ munt", "☑ druif", "☑ citroen"].map((p) => (
            <span key={p} className="text-sm border border-border rounded-full px-3 py-1">{p}</span>
          ))}
        </div>
      </Section>

      <Section emoji="🔔" title="Slimme herinneringen">
        <p className="text-sm text-muted-foreground mb-3">Gebaseerd op plant + weer.</p>
        <div className="space-y-2">
          {[
            "💧 Paprika hoeft vandaag geen water.",
            "🌿 Citroen bemesten over 2 dagen.",
            "✂ Tijd om de munt terug te knippen.",
            "🍅 Tomaten bijna rijp.",
          ].map((r) => (
            <div key={r} className="text-sm rounded-xl border border-border/60 bg-card px-4 py-2.5">{r}</div>
          ))}
        </div>
      </Section>

      <Section emoji="📊" title="Groei-statistieken">
        <p className="text-sm text-muted-foreground">Per plant grafieken van hoogte, vruchten, watergiften, bemestingen en foto's over de tijd.</p>
      </Section>

      <Section emoji="🌎" title="Plantkaart">
        <p className="text-sm text-muted-foreground mb-3">Alle planten op één pagina, filteren op:</p>
        <div className="flex flex-wrap gap-1.5">
          {["☀ zon", "💧 water", "🌱 grond", "🍅 moestuin", "🌸 bloemen", "🌳 bomen", "🐝 bijvriendelijk", "🐈 diervriendelijk", "🪴 pot", "Kas", "Winterhard", "Eetbaar", "Medicinaal", "Inheems"].map((f) => (
            <span key={f} className="text-xs border border-border rounded-full px-2.5 py-1">{f}</span>
          ))}
        </div>
      </Section>

      <Section emoji="⭐" title="Persoonlijke score">
        <p className="text-sm text-muted-foreground mb-3">Per plant een verzorgingsscore:</p>
        <div className="space-y-1.5">
          {[
            { label: "🌞 Zon", pct: "100%" },
            { label: "💧 Water", pct: "95%" },
            { label: "🌿 Voeding", pct: "80%" },
            { label: "✂ Snoei", pct: "100%" },
            { label: "📷 Logboek", pct: "bijgehouden" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium">{s.pct}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="🧠" title="Extra ideeën">
        <div className="space-y-3">
          {[
            { emoji: "🧠", title: "AI Tuincoach", desc: "Typ \"Mijn tomaat heeft gele bladeren\" en krijg direct een diagnose met vervolgstappen." },
            { emoji: "📷", title: "Fotoherkenning", desc: "Upload een foto en laat AI mogelijke ziektes, plagen of tekorten herkennen." },
            { emoji: "🌱", title: "Persoonlijke plantkalender", desc: "Automatisch gegenereerd op basis van de planten die iemand bezit." },
            { emoji: "🧪", title: "Bodemchecker", desc: "Vul bodemtype en pH in en krijg advies welke planten geschikt zijn." },
            { emoji: "🐝", title: "Biodiversiteitsscore", desc: "Laat zien hoe aantrekkelijk de tuin is voor bijen, vlinders en vogels." },
            { emoji: "🗺️", title: "Plantplanner", desc: "Ontwerp een border of moestuinvak en controleer plantafstanden en combinatieteelt." },
            { emoji: "🏆", title: "Oogst- en groeistatistieken", desc: "Bijhouden hoeveel vruchten of bloemen een plant per seizoen heeft opgeleverd." },
            { emoji: "🌦️", title: "Slim weeradvies", desc: "Combineer weersverwachting met persoonlijke verzorgingstaken." },
          ].map((idea) => (
            <div key={idea.title} className="rounded-xl border border-border/60 bg-card px-4 py-3">
              <p className="font-medium text-sm">{idea.emoji} {idea.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{idea.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 italic">
          Als dit goed uitgewerkt wordt, is het niet alleen een mooie website, maar een volwaardig digitaal tuinplatform waar zowel beginners als ervaren tuiniers dagelijks iets aan hebben.
        </p>
      </Section>
    </div>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
      <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
        <span>{emoji}</span> {title}
      </h2>
      {children}
    </div>
  );
}
