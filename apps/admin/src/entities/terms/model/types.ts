export interface TermsItem {
  id: string;
  title: string;
  type: string;
  version: string;
  isRequired: boolean;
  isActive: boolean;
  fileId: string | null;
  file?: {
    originalName: string;
    sizeByte: string;
    localPath: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TermsDetail {
  title: string;
  version: string;
  content: string;
}
