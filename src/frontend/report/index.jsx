import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Heading,
  Stack,
  Box,
  DynamicTable,
  Spinner,
  SectionMessage,
  useProductContext
} from '@forge/react';
import { invoke } from '@forge/bridge';

const TimeTrackingReport = () => {
  const [issues, setIssues] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await invoke('getTimeTrackingReport');
        setIssues(data?.issues || []);
        setTotals(data?.totals || null);
      } catch (err) {
        console.error('Error fetching time tracking report:', err);
        setError(err?.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Define columns for the DynamicTable
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

  // Transform issues data for the table
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
            <Text>No issues with time tracking data found.</Text>
          </SectionMessage>
        ) : (
          <>
            <DynamicTable
              columns={columns}
              rows={tableRows}
              isLoading={false}
              testId="time-tracking-table"
            />

            {/* Totals Summary */}
            <Box>
              <Heading size="large">Totals</Heading>
              <Stack space="space.100">
                <Text>
                  <strong>Total Original Estimate:</strong> {Number(totals?.originalEstimateHours || 0).toFixed(2)}h (${Number(totals?.originalEstimateCost || 0).toFixed(2)})
                </Text>
                <Text>
                  <strong>Total Time Spent:</strong> {Number(totals?.timeSpentHours || 0).toFixed(2)}h (${Number(totals?.timeSpentCost || 0).toFixed(2)})
                </Text>
                <Text>
                  <strong>Total Remaining:</strong> {Number(totals?.remainingHours || 0).toFixed(2)}h (${Number(totals?.remainingCost || 0).toFixed(2)})
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
