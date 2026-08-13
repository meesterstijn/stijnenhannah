export interface EncyclopediaCategory {
  id: string;
  emoji: string;
  title: string;
  description: string;
  sections: Array<{
    heading: string;
    content: string;
    tips?: string[];
  }>;
}

export interface DiagnoseOorzaak {
  title: string;
  probability: number; // 1-5 sterren: meest voorkomende oorzaak in de praktijk
  symptoms: string[];
  solution: string[];
  recoveryTime?: string; // geschatte hersteltijd
}

export interface Diagnose {
  id: string;
  category: "bladeren" | "bloemen" | "vruchten" | "groei" | "wortels" | "plagen";
  title: string;
  emoji: string;
  description: string;
  severity: "laag" | "gemiddeld" | "hoog" | "kritiek";
  oorzaken: DiagnoseOorzaak[];
  prevention: string[];
  related: string[];
}

export interface LogEntry {
  id: string;
  plant_id: string | null;
  plant_name: string;
  // Instance/season linkage — nullable because legacy entries (recorded
  // before the species/instance split, or free-text notes with no matching
  // plant) cannot always be reliably linked. New entries recorded from a
  // concrete plant instance always populate both.
  plant_instance_id: string | null;
  growing_season_id: string | null;
  date: string;
  height_cm: number | null;
  flower_count: number | null;
  fruit_count: number | null;
  fruit_length_cm: number | null;
  fruit_width_cm: number | null;
  // Momentopname van plant_instances.quantity op het moment van deze entry —
  // batchtracking-historie ("21 zaailingen opgekomen", "18 planten over na
  // dunnen"). Null voor entries die geen aantalswijziging registreren.
  quantity: number | null;
  notes: string;
  watered: boolean;
  fertilized: boolean;
  photo_url: string;
  created_at: string;
}
