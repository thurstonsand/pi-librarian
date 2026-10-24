export type RepoEntryType = "file" | "directory" | "symlink" | "submodule";

export interface RepoDirectoryEntry {
  name: string;
  type: RepoEntryType;
}

export type RepoEntry =
  | { type: "file"; size: number; bytes: Buffer }
  | { type: "directory"; entries: RepoDirectoryEntry[] }
  | { type: "symlink"; target: string }
  | { type: "submodule"; url: string | undefined };

export interface ReadEntryRequest {
  repo: string;
  path: string;
  ref: string | undefined;
  maxBytes: number;
  signal: AbortSignal | undefined;
}

// One per code host. Each learns what an entry is before reading it, because a raw body cannot
// tell a submodule from an empty file or a symlink from a one-line text file.
export interface RepoFileReader {
  readEntry(request: ReadEntryRequest): Promise<RepoEntry>;
}

export class EntryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntryNotFoundError";
  }
}

export class EntryTooLargeError extends Error {
  constructor(readonly size: number) {
    super(`File is ${size} bytes.`);
    this.name = "EntryTooLargeError";
  }
}
