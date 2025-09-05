import Dexie, { type Table } from "dexie";
export interface Entry { id?: number; createdAt: number; updatedAt: number; title: string; body: string; tags: string[]; }
class DiaryDB extends Dexie { entries!: Table<Entry, number>;
  constructor(){ super("portal-diary"); this.version(1).stores({ entries: "++id, createdAt, updatedAt, title" }); } }
export const db = new DiaryDB();
