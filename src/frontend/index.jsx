import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Textfield, Button, Inline } from '@forge/react';
import { requestJira, invoke, getContext } from '@forge/bridge';

const App = () => {
  const [issueKey, setIssueKey] = useState(null);
  const [rateInput, setRateInput] = useState('');
  const [savedRate, setSavedRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [originalEstimateHours, setOriginalEstimateHours] = useState(0);
  const [timeSpentHours, setTimeSpentHours] = useState(0);
  const [remainingHours, setRemainingHours] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer resolver for issue key (matches issue panel behavior)
        const resp = await invoke('getIssueContext').catch(() => null);
        console.log('resolver resp:', resp);
        const urlKey = (() => {
          try {
            const params = new URLSearchParams(window.location.search || '');
            return params.get('issueKey') || params.get('issue') || null;
          } catch (e) {
            return null;
          }
        })();
        // Try values returned by resolver first, then URL, then bridge context
        let finalKey = resp?.issueKey || resp?.context?.extension?.issue?.key || resp?.context?.issue?.key || urlKey || null;
        // Additional URL/pathname fallbacks (handles /browse/ISSUE-123 and selectedIssue query param)
        if (!finalKey) {
          try {
            const href = window.location.href || '';
            const path = window.location.pathname || '';
            const browseMatch = href.match(/\/browse\/([A-Z0-9]+-[0-9]+)/i) || path.match(/\/browse\/([A-Z0-9]+-[0-9]+)/i);
            if (browseMatch && browseMatch[1]) finalKey = browseMatch[1];
            if (!finalKey) {
              const params = new URLSearchParams(window.location.search || '');
              const sel = params.get('selectedIssue') || params.get('selectedIssueKey') || params.get('issueKey') || params.get('issue') || params.get('selectedIssue');
              if (sel) finalKey = sel;
            }
          } catch (e) {
            // ignore
          }
        }
        if (!finalKey) {
          const ctx = await getContext().catch(() => null);
          finalKey = ctx?.issue?.key || ctx?.extension?.issue?.key || ctx?.issueKey || null;
        }
        if (!mounted) return;
        setIssueKey(finalKey);
        if (!finalKey) {
          setLoading(false);
          return;
        }
        const [propRes, issueRes] = await Promise.all([
          requestJira(`/rest/api/3/issue/${finalKey}/properties/rate`, { method: 'GET' }),
          requestJira(`/rest/api/3/issue/${finalKey}?fields=timeoriginalestimate,timetracking,timespent,timeestimate`, { method: 'GET' })
        ]);
        const propBody = await propRes.json().catch(() => null);
        setSavedRate(propBody?.value ?? null);
        const issueBody = await issueRes.json().catch(() => null);
        const secs = issueBody?.fields?.timeoriginalestimate ?? issueBody?.fields?.timetracking?.originalEstimateSeconds ?? 0;
        const hours = secs ? Number(secs) / 3600 : 0;
        setOriginalEstimateHours(hours);
        const spentSecs = issueBody?.fields?.timespent ?? 0;
        const spentHours = spentSecs ? Number(spentSecs) / 3600 : 0;
        setTimeSpentHours(spentHours);
        const remainingSecs = issueBody?.fields?.timeestimate ?? issueBody?.fields?.timetracking?.remainingEstimateSeconds ?? null;
        const remHours = (remainingSecs !== null && remainingSecs !== undefined) ? Number(remainingSecs) / 3600 : Math.max(0, hours - spentHours);
        setRemainingHours(remHours);
      } catch (err) {
        setSavedRate(null);
        setOriginalEstimateHours(0);
        setTimeSpentHours(0);
        setRemainingHours(0);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const saveRate = async () => {
    console.log('issue key:', issueKey);
    if (!issueKey) {
      setStatusMsg('No issue key found; cannot save.');
      return;
    }
    const amount = parseFloat(rateInput.replace(/[^0-9.]/g, '')) || 0;
    const payload = { currency: 'USD', amount };
    setStatusMsg('Saving...');
    setLoading(true);
    try {
      const res = await requestJira(`/rest/api/3/issue/${issueKey}/properties/rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res && res.status && (res.status === 200 || res.status === 201 || res.status === 204)) {
        setSavedRate(payload);
        setShowEditor(false);
        setStatusMsg('Saved.');
      } else {
        setStatusMsg(`Save failed (status ${res?.status ?? 'unknown'})`);
      }
    } catch (err) {
      console.error('Failed to save rate', err);
      setStatusMsg(`Save error: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  const openEditor = () => {
    const current = savedRate?.amount ?? 0;
    setRateInput(Number(current).toFixed(2));
    setShowEditor(true);
  };

  const cancelEdit = () => {
    setShowEditor(false);
    setRateInput('');
  };

  return (
    <>
      {!showEditor && (
        <>
          <Inline space="space.100" alignBlock="center">
            <Text>
              {loading ? 'Loading...' : `Rate: $${Number(savedRate?.amount ?? 0).toFixed(2)}`}
            </Text>
            <Button onClick={openEditor} disabled={loading}>Set rate</Button>
          </Inline>
          {!loading && (
            <Text>
              {`Original estimate: ${Number(originalEstimateHours).toFixed(2)}h — Cost: $${Number((savedRate?.amount ?? 0) * originalEstimateHours).toFixed(2)}`}
            </Text>
          )}
          {!loading && (
            <Text>
              {`Time spent: ${Number(timeSpentHours).toFixed(2)}h — Cost spent: $${Number((savedRate?.amount ?? 0) * timeSpentHours).toFixed(2)}`}
            </Text>
          )}
          {!loading && (
            <Text>
              {`Remaining: ${Number(remainingHours).toFixed(2)}h — Remaining cost: $${Number((savedRate?.amount ?? 0) * remainingHours).toFixed(2)}`}
            </Text>
          )}
        </>
      )}

      {showEditor && (
        <Inline space="space.100" alignBlock="center">
          <Textfield value={rateInput} onChange={(e) => setRateInput(e.target?.value ?? e)} />
          <Button onClick={saveRate} disabled={loading}>Save</Button>
          <Button onClick={cancelEdit} disabled={loading}>Cancel</Button>
        </Inline>
      )}
      {!!statusMsg && (
        <Text>{statusMsg}</Text>
      )}
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
