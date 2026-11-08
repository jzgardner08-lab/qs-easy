export type Category = "Preliminaries" | "Substructure" | "Superstructure" | "Finishes" | "Services" | "Other";

export interface BoQItem {
  id: string;
  description: string;
  category: Category;
  unit: string;
  quantity: number;
  unitRate: number;
  progress: number; // Represents percentage completion from 0 to 100
}

export interface Variation {
  id: string;
  description: string;
  impactAmount: number; // Can be a positive or negative value (e.g., +5000 or -2000)
  date: string;
  status: "Pending" | "Approved" | "Rejected";
}

export interface Project {
  id: string;
  name: string;
  description: string;
  items: BoQItem[];
  variations: Variation[];
}