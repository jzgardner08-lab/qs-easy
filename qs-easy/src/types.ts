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
  reference?: string;
  quotation?: number;
  approvedOn?: string;
  notes?: string;
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
  archived?: boolean;
  valuations?: Valuation[];
  costs?: CostPackage[];
  risks?: Risk[];
  quotes?: Quote[];
  documents?: Attachment[];
  notes?: SiteNote[];
  programme?: { start: string; months: number; weights?: number[] };
  report?: { company: string; client: string; reference: string; period: string; author: string; comments: string; approval: string };

}
export interface Valuation { id:string; period:string; work:number; materials:number; changes:number; retention:number; previous:number; due:number }
export interface CostPackage { id:string; name:string; budget:number; committed:number; actual:number; remaining:number }
export interface Risk { id:string; name:string; kind:string; probability:number; impact:number; owner:string; mitigation:string }
export interface Quote { id:string; contractor:string; itemId:string; rate:number; exclusions:string; qualifications:string }
export interface Rate { id:string; description:string; unit:string; amount:number; supplier:string; region:string; date:string }
export interface Attachment { id:string; name:string; target:string; data:string; date:string }
export interface SiteNote { id:string; itemId:string; date:string; note:string; progress:number }
export interface Portfolio { projects:Project[]; rates:Rate[] }
export type UpdateProject = (project:Project) => void
