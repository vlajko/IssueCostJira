import Resolver from '@forge/resolver';
import { asUser, route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getText', (req) => {
  console.log(req);
  return 'Hello, world!';
});

resolver.define('getIssueContext', (req) => {
  console.log('getIssueContext req.context:', req?.context);
  const issueKey = req?.context?.extension?.issue?.key || req?.context?.issue?.key || req?.context?.issueKey || null;
  const issueId = req?.context?.extension?.issue?.id || req?.context?.issue?.id || null;
  return { issueKey, issueId, context: req?.context ?? null };
});

// Fetches all issues with time tracking data and their stored rates
resolver.define('getTimeTrackingReport', async (req) => {
  try {
    // Fetch all issues that have time tracking (using JQL)
    // This will fetch issues with either original estimate or time spent
    // JQL: all issues the user can see
    const jql = 'project IS NOT EMPTY ORDER BY updated DESC';
    const fields = 'key,summary,timeoriginalestimate,timetracking,timespent,timeestimate';
    const maxResults = 100;
    const issuesRes = await asUser().requestJira(
      route`/rest/api/3/search?jql=${jql}&fields=${fields}&maxResults=${maxResults}`,
      {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      }
    );

    if (!issuesRes.ok) {
      const errorText = await issuesRes.text().catch(() => 'Unknown error');
      return {
        issues: [],
        totals: {
          originalEstimateHours: 0,
          timeSpentHours: 0,
          remainingHours: 0,
          originalEstimateCost: 0,
          timeSpentCost: 0,
          remainingCost: 0,
        },
        error: `Search failed (${issuesRes.status}): ${errorText}`,
      };
    }

    const issuesData = await issuesRes.json().catch(() => ({ issues: [] }));
    const issues = issuesData?.issues || [];

    // Enrich each issue with its rate from entity properties
    const enrichedIssues = await Promise.all(
      issues.map(async (issue) => {
        try {
          const propRes = await asUser().requestJira(
            route`/rest/api/3/issue/${issue.key}/properties/rate`,
            { method: 'GET' }
          );
          const propBody = await propRes.json().catch(() => null);
          const rate = propBody?.value?.amount || 0;

          // Extract time values in seconds
          const originalEstimateSecs = issue.fields?.timeoriginalestimate || issue.fields?.timetracking?.originalEstimateSeconds || 0;
          const timeSpentSecs = issue.fields?.timespent || 0;
          const remainingEstimateSecs = issue.fields?.timeestimate || issue.fields?.timetracking?.remainingEstimateSeconds || null;

          // Convert to hours
          const originalEstimateHours = originalEstimateSecs ? Number(originalEstimateSecs) / 3600 : 0;
          const timeSpentHours = timeSpentSecs ? Number(timeSpentSecs) / 3600 : 0;
          const remainingHours = remainingEstimateSecs !== null && remainingEstimateSecs !== undefined
            ? Number(remainingEstimateSecs) / 3600
            : Math.max(0, originalEstimateHours - timeSpentHours);

          return {
            key: issue.key,
            summary: issue.fields?.summary || 'Unknown',
            rate,
            originalEstimateHours,
            timeSpentHours,
            remainingHours,
            originalEstimateCost: rate * originalEstimateHours,
            timeSpentCost: rate * timeSpentHours,
            remainingCost: rate * remainingHours,
          };
        } catch (err) {
          console.error(`Error fetching rate for ${issue.key}:`, err);
          return {
            key: issue.key,
            summary: issue.fields?.summary || 'Unknown',
            rate: 0,
            originalEstimateHours: 0,
            timeSpentHours: 0,
            remainingHours: 0,
            originalEstimateCost: 0,
            timeSpentCost: 0,
            remainingCost: 0,
          };
        }
      })
    );

    // Calculate totals
    const totals = {
      originalEstimateHours: enrichedIssues.reduce((sum, i) => sum + i.originalEstimateHours, 0),
      timeSpentHours: enrichedIssues.reduce((sum, i) => sum + i.timeSpentHours, 0),
      remainingHours: enrichedIssues.reduce((sum, i) => sum + i.remainingHours, 0),
      originalEstimateCost: enrichedIssues.reduce((sum, i) => sum + i.originalEstimateCost, 0),
      timeSpentCost: enrichedIssues.reduce((sum, i) => sum + i.timeSpentCost, 0),
      remainingCost: enrichedIssues.reduce((sum, i) => sum + i.remainingCost, 0),
    };

    return {
      issues: enrichedIssues,
      totals,
    };
  } catch (err) {
    console.error('Error in getTimeTrackingReport:', err);
    return {
      issues: [],
      totals: {
        originalEstimateHours: 0,
        timeSpentHours: 0,
        remainingHours: 0,
        originalEstimateCost: 0,
        timeSpentCost: 0,
        remainingCost: 0,
      },
      error: err?.message || String(err),
    };
  }
});

export const handler = resolver.getDefinitions();
