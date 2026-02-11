import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getText', (req) => {
  console.log(req);
  return 'Hello, world!';
});

resolver.define('getIssueContext', (req) => {
  const issueKey = req?.context?.extension?.issue?.key || req?.context?.issue?.key || null;
  return { issueKey };
});

export const handler = resolver.getDefinitions();
