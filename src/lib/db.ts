import Dexie, { type Table } from "dexie";
export interface Attachment { id?:number; entryId:number; name:string; type:string; size:number; createdAt:number; data:Blob; }
export interface Entry { id?:number; createdAt:number; updatedAt:number; title:string; body:string; tags:string[]; pinned:boolean; archived:boolean; trashed:boolean; enc?:boolean; }
class DiaryDB extends Dexie {
  entries!: Table<Entry, number>; attachments!: Table<Attachment, number>;
  constructor(){ super("portal-diary-pro");
    this.version(3).stores({
      entries: "++id, createdAt, updatedAt, title, pinned, archived, trashed",
      attachments: "++id, entryId, createdAt"
    });
  }
}
export const db = new DiaryDB();
