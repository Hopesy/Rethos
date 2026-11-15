import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { writeFileAtomic } from "./atomic.ts";

export const computerAccessMode = z.enum(["enabled", "paused", "revoked"]);
export type ComputerAccessMode = z.infer<typeof computerAccessMode>;
const recordSchema = z.object({ person: z.string().min(1), id: z.string().uuid(), mode: computerAccessMode, grantRevision: z.string().uuid().optional() }).strict();
type Record = z.infer<typeof recordSchema>;

export class ComputerAccess {
  private records: Record[];
  private readonly file: string | undefined;
  constructor(file?: string) {
    this.file = file;
    this.records = file && existsSync(file)
      ? z.object({ version: z.literal(1), records: z.array(recordSchema) }).strict().parse(JSON.parse(readFileSync(file, "utf8"))).records
      : [];
  }
  mode(person: string, id: string): ComputerAccessMode { return this.records.find(item => item.person === person && item.id === id)?.mode ?? "enabled"; }
  private save(records: Record[]) { if (this.file) writeFileAtomic(this.file, JSON.stringify({ version: 1, records }) + "\n", { mode: 0o600 }); }
  set(person: string, id: string, mode: ComputerAccessMode, grantRevision?: string): void {
    const old = this.records.find(item => item.person === person && item.id === id);
    const next = [...this.records.filter(item => item !== old), { person, id, mode, ...(grantRevision ?? old?.grantRevision ? { grantRevision: grantRevision ?? old?.grantRevision } : {}) }];
    if (mode !== "enabled") this.records = next;
    this.save(next);
    this.records = next;
  }
  registered(person: string, id: string, grantRevision?: string): void {
    const old = this.records.find(item => item.person === person && item.id === id);
    if (grantRevision && grantRevision !== old?.grantRevision) this.set(person, id, "enabled", grantRevision);
  }
}
