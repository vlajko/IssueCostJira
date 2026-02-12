import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Heading,
  Stack,
  Box,
  DynamicTable,
  Spinner,
  SectionMessage,
  Strong,
} from '@forge/react';
import { requestJira } from '@forge/bridge';

const TimeTrackingReport = () => {
  const [issues, setIssues] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const jql = 'project IS NOT EMPTY ORDER BY updated DESC';
        const fields = 'key,summary,timeoriginalestimate,timetracking,timespent,timeestimate';
        const searchParams = new URLSearchParams({
          jql,
          fields,
          maxResults: '100',
        });
        const searchRes = await requestJira(`/rest/api/3/search/jql?${searchParams.toString()}`, {
          method: 'GET',
        });

        if (!searchRes.ok) {
          const errorText = await searchRes.text().catch(() => 'Unknown error');
          throw new Error(`Search failed (${searchRes.status}): ${errorText}`);
        }

        const issuesData = await searchRes.json().catch(() => ({ issues: [] }));
        const rawIssues = issuesData?.issues || [];

        const enrichedIssues = await Promise.all(
          rawIssues.map(async (issue) => {
            let rateAmount = 0;
            try {
              const propRes = await requestJira(`/rest/api/3/issue/${issue.key}/properties/rate`, {
                method: 'GET',
              });
              if (propRes.status === 404) {
                rateAmount = 0;
              } else if (!propRes.ok) {
                const errText = await propRes.text().catch(() => 'Unknown error');
                throw new Error(`Rate fetch failed (${propRes.status}): ${errText}`);
              } else {
                const propBody = await propRes.json().catch(() => null);
                rateAmount = propBody?.value?.amount || 0;
              }
            } catch (err) {
              console.error(`Error fetching rate for ${issue.key}:`, err);
              rateAmount = 0;
            }

            const originalEstimateSecs = issue.fields?.timeoriginalestimate || issue.fields?.timetracking?.originalEstimateSeconds || 0;
            const timeSpentSecs = issue.fields?.timespent || 0;
            const remainingEstimateSecs = issue.fields?.timeestimate || issue.fields?.timetracking?.remainingEstimateSeconds || null;

            const originalEstimateHours = originalEstimateSecs ? Number(originalEstimateSecs) / 3600 : 0;
            const timeSpentHours = timeSpentSecs ? Number(timeSpentSecs) / 3600 : 0;
            const remainingHours = remainingEstimateSecs !== null && remainingEstimateSecs !== undefined
              ? Number(remainingEstimateSecs) / 3600
              : Math.max(0, originalEstimateHours - timeSpentHours);

            return {
              key: issue.key,
              summary: issue.fields?.summary || 'Unknown',
              rate: rateAmount,
              originalEstimateHours,
              timeSpentHours,
              remainingHours,
              originalEstimateCost: rateAmount * originalEstimateHours,
              timeSpentCost: rateAmount * timeSpentHours,
              remainingCost: rateAmount * remainingHours,
            };
          })
        );

        const totals = {
          originalEstimateHours: enrichedIssues.reduce((sum, i) => sum + i.originalEstimateHours, 0),
          timeSpentHours: enrichedIssues.reduce((sum, i) => sum + i.timeSpentHours, 0),
          remainingHours: enrichedIssues.reduce((sum, i) => sum + i.remainingHours, 0),
          originalEstimateCost: enrichedIssues.reduce((sum, i) => sum + i.originalEstimateCost, 0),
          timeSpentCost: enrichedIssues.reduce((sum, i) => sum + i.timeSpentCost, 0),
          remainingCost: enrichedIssues.reduce((sum, i) => sum + i.remainingCost, 0),
        };

        setIssues(enrichedIssues);
        setTotals(totals);
      } catch (err) {
        console.error('Error fetching time tracking report:', err);
        setError(err?.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns = [
    { key: 'key', title: 'Issue Key', width: 12 },
    { key: 'summary', title: 'Summary', width: 30 },
    { key: 'rate', title: 'Rate ($/hr)', width: 12 },
    { key: 'originalEstimateHours', title: 'Original Est. (h)', width: 15 },
    { key: 'originalEstimateCost', title: 'Original Cost ($)', width: 15 },
    { key: 'timeSpentHours', title: 'Time Spent (h)', width: 13 },
    { key: 'timeSpentCost', title: 'Spent Cost ($)', width: 13 },
    { key: 'remainingHours', title: 'Remaining (h)', width: 13 },
    { key: 'remainingCost', title: 'Remaining Cost ($)', width: 15 },
  ];

  const tableRows = issues.map((issue, idx) => ({
    key: `row-${idx}`,
    cells: [
      { key: 'key', content: issue.key },
      { key: 'summary', content: issue.summary },
      { key: 'rate', content: `$${Number(issue.rate).toFixed(2)}` },
      { key: 'originalEstimateHours', content: `${Number(issue.originalEstimateHours).toFixed(2)}` },
      { key: 'originalEstimateCost', content: `$${Number(issue.originalEstimateCost).toFixed(2)}` },
      { key: 'timeSpentHours', content: `${Number(issue.timeSpentHours).toFixed(2)}` },
      { key: 'timeSpentCost', content: `$${Number(issue.timeSpentCost).toFixed(2)}` },
      { key: 'remainingHours', content: `${Number(issue.remainingHours).toFixed(2)}` },
      { key: 'remainingCost', content: `$${Number(issue.remainingCost).toFixed(2)}` },
    ],
  }));

  if (loading) {
    return (
      <Box>
        <Heading size="xlarge">Time Tracking Report</Heading>
        <Stack space="space.200">
          <Spinner size="large" />
          <Text>Loading report...</Text>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Heading size="xlarge">Time Tracking Report</Heading>
        <Stack space="space.200">
          <SectionMessage appearance="error">
            <Text>{error}</Text>
          </SectionMessage>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Stack space="space.300">
        <Heading size="xlarge">Time Tracking Report</Heading>

        {issues.length === 0 ? (
          <SectionMessage appearance="information">
            <Text>No issues found.</Text>
          </SectionMessage>
        ) : (
          <>
            <Heading size="large">Issues</Heading>
            <DynamicTable
              columns={columns}
              rows={tableRows}
              isLoading={false}
              testId="time-tracking-table"
            />

            <Box>
              <Heading size="large">Totals</Heading>
              <Stack space="space.100">
                <Text>
                  <Strong>Total Original Estimate:</Strong> {Number(totals?.originalEstimateHours || 0).toFixed(2)}h (${Number(totals?.originalEstimateCost || 0).toFixed(2)})
                </Text>
                <Text>
                  <Strong>Total Time Spent:</Strong> {Number(totals?.timeSpentHours || 0).toFixed(2)}h (${Number(totals?.timeSpentCost || 0).toFixed(2)})
                </Text>
                <Text>
                  <Strong>Total Remaining:</Strong> {Number(totals?.remainingHours || 0).toFixed(2)}h (${Number(totals?.remainingCost || 0).toFixed(2)})
                </Text>
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <TimeTrackingReport />
  </React.StrictMode>
);