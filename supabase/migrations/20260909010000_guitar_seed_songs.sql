-- Gitaar — testdata: 2 albums, 4 fictieve nummers met bewust korte, zelf
-- geschreven voorbeeldlyrics (GEEN bestaande, auteursrechtelijk beschermde
-- songtekst) die samen majeur/mineur/7-akkoorden/sus/add9/slash chords,
-- meerdere sectietypes en een capo-scenario (Original F# -> Capo 2 -> Play E)
-- demonstreren. Vaste uuid's + on conflict do nothing.

insert into public.guitar_albums (id, title, artist, description) values
  ('a1000000-0000-4000-8000-000000000001', 'Ochtendlicht', 'Stille Aarde',
   'Rustige nummers voor de vroege dienst.'),
  ('a1000000-0000-4000-8000-000000000002', 'Weerklank', 'Open Hemel',
   'Ingetogen worship, geschikt voor akoestische set.')
on conflict (id) do nothing;

insert into public.guitar_songs
  (id, title, artist, album_id, original_key, bpm, favorite, source_url, content)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'Genadig Licht',
    'Stille Aarde',
    'a1000000-0000-4000-8000-000000000001',
    'A',
    72,
    true,
    null,
    E'# Verse 1
[A]Genadig licht dat [E]schijnt in mij
[F#m]Een nieuw begin, [D]U maakt vrij
[A]Wat was gebroken [E]wordt weer heel
[F#m]In uw aanwezig [D]heid

# Chorus
[A]Hier ben ik, [E]hier sta ik
[F#m]Vol van dank, [D]vol van U
[A]Hier ben ik, [E]hier sta ik
[F#m]Voor altijd [D]dicht bij U'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'Onwankelbaar',
    'Stille Aarde',
    'a1000000-0000-4000-8000-000000000001',
    'D',
    96,
    false,
    null,
    E'# Verse 1
[D]Wat een rots waarop ik [Dsus4]sta[D]
[Bm7]Onwankelbaar en [Em7]nooit [Asus4]alleen[A]

# Pre-Chorus
[G]Al waait de storm, [A]al breekt de golf
[Bm]Ik hou mijn ogen [A/C#]op U gericht

# Chorus
[D]Onwankelbaar, [A/C#]onwankelbaar
[Bm]Op U alleen, [G]op U [D/F#]alleen
[G]Onwankelbaar, [D]onwankelbaar
[Em7]Vandaag en voor [A]altijd

# Bridge
[G]Al wat wankelt, [D/F#]al wat valt
[Em7]U bent de rots [A]die blijft staan'
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'Vrij Om Te Zingen',
    'Open Hemel',
    'a1000000-0000-4000-8000-000000000002',
    'F#',
    84,
    true,
    'https://example.com/vrij-om-te-zingen',
    E'# Intro
[F#] [C#] [D#m] [B]

# Verse 1
[F#]In de stilte van de [C#]morgen
[D#m]Vind ik rust bij [B]U
[F#]Alle lasten mag ik [C#]neerleggen
[D#m]Hier, in [B]uw huis

# Chorus
[F#]Vrij om te zingen, [C#]vrij om te staan
[D#m]Met open handen [B]ga ik
[F#]Vrij om te zingen, [C#]vrij om te gaan
[D#m]Waar U mij [B]leidt

# Outro
[F#]Vrij, [C#]vrij, [D#m]helemaal [B]vrij'
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    'Adem van Leven',
    'Open Hemel',
    'a1000000-0000-4000-8000-000000000002',
    'G',
    68,
    false,
    null,
    E'# Intro
[G] [D] [Em] [C]

# Verse 1
[G]Adem van leven, [D]kom en vul dit huis
[Em]Wij heffen onze handen [C]op
[G]Adem van leven, [D]stroom door ons heen
[Em]Wij geven ons over aan [C]U

# Pre-Chorus
[Em]Wachtend, [C]hopend
[G]Op wat komen [D]gaat

# Chorus
[G]U bent de adem, [D]U bent het leven
[Em]In U bewegen wij, [C]in U bestaan wij
[G]U bent de adem, [D]U bent het leven
[Em]Alles wat ik [C]ben is van U

# Instrumental
[G] [D] [Em] [C]

# Bridge
[C]Groter dan de bergen, [G]dieper dan de zee
[D]Uw liefde kent geen einde, [Em]neem ons met U mee
[C]Groter dan de bergen, [G]dieper dan de zee
[D]Wij geven ons [Em]over, [C]helemaal

# Interlude
[G] [D]

# Outro
[G]In U bewegen wij, [D]in U bestaan wij [Em] [C] [G]

# Spontaneous
[G] [D] [Em] [C]'
  )
on conflict (id) do nothing;