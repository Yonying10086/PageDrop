import type { RateLimitInfo } from '../utils/rateLimit';
import { GhError, ghFetch } from './github';
import type { PagesInfo, WorkflowRun } from './types';

export interface DeployStatus {
  actionsStatus: 'queued' | 'in_progress' | 'completed' | 'none';
  conclusion: string | null;
  pagesStatus: string | null;
  siteUrl: string | null;
  runUrl: string | null;
}

export async function fetchDeployStatus(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ status: DeployStatus; rate: RateLimitInfo }> {
  let actionsStatus: DeployStatus['actionsStatus'] = 'none';
  let conclusion: string | null = null;
  let runUrl: string | null = null;
  let rate: RateLimitInfo | null = null;

  try {
    const runs = await ghFetch<{ workflow_runs: WorkflowRun[] }>(
      `/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`,
      { token },
    );
    rate = runs.rate;
    const run = runs.data.workflow_runs?.[0];
    if (run) {
      actionsStatus =
        run.status === 'completed'
          ? 'completed'
          : run.status === 'in_progress'
            ? 'in_progress'
            : 'queued';
      conclusion = run.conclusion;
      runUrl = run.html_url;
    }
  } catch (e) {
    if (!(e instanceof GhError) || (e.status !== 404 && e.status !== 403)) throw e;
  }

  let pagesStatus: string | null = null;
  let siteUrl: string | null = null;
  try {
    const pages = await ghFetch<PagesInfo>(`/repos/${owner}/${repo}/pages`, { token });
    rate = pages.rate;
    pagesStatus = pages.data.status ?? null;
    siteUrl = pages.data.html_url ?? null;
  } catch (e) {
    if (!(e instanceof GhError) || e.status !== 404) throw e;
  }

  return {
    status: { actionsStatus, conclusion, pagesStatus, siteUrl, runUrl },
    rate: rate ?? { remaining: 0, limit: 0, reset: 0 },
  };
}
