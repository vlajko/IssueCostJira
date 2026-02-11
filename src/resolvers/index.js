import Resolver from '@forge/resolver';

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

export const handler = resolver.getDefinitions();
