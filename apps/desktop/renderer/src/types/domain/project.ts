export interface LumiFile {
  id: string;
  name: string;
  path: string;
  content: string;
  isEntry?: boolean;
}

export interface LumiProject {
  id: string;
  name: string;
  description: string;
  location?: string;
  files: LumiFile[];
  activeFileId: string;
  entryFileId?: string;
  openTabIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EntryFileInfo {
  id: string;
  name: string;
  path: string;
}
