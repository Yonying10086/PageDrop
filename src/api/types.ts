export interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
  size: number;
  html_url: string;
  owner: { login: string };
  has_pages?: boolean;
}

export interface PagesInfo {
  status: string | null;
  html_url?: string | null;
  cname?: string | null;
  https_enforced?: boolean;
}

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

export interface GitRef {
  ref: string;
  object: { sha: string; type: string };
}

export interface GitTree {
  sha: string;
}

export interface GitCommit {
  sha: string;
}

export interface BlobResult {
  sha: string;
}

export type PageId = 'welcome' | 'auth' | 'workspace' | 'files' | 'domain' | 'deploy' | 'result' | 'help';
