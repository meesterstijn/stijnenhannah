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
  probability: number; // 1-5 sterren
  symptoms: string[];
  solution: string[];
}

export interface Diagnose {
  id: string;
  category: "bladeren" | "bloemen" | "vruchten" | "groei" | "wortels";
  title: string;
  emoji: string;
  description: string;
  oorzaken: DiagnoseOorzaak[];
  prevention: string[];
  related: string[];
}

export interface LogEntry {
  id: string;
  plant_id: string | null;
  plant_name: string;
  date: string;
  height_cm: number | null;
  flower_count: number | null;
  fruit_count: number | null;
  notes: string;
  watered: boolean;
  fertilized: boolean;
  photo_url: string;
  created_at: string;
}
