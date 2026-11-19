// Read-only billing preflight. Print only plan and Update usage, never the token or raw account payload.
const token = process.env.EXPO_TOKEN;
if (!token) throw new Error('EXPO_TOKEN no disponible');
async function query(query, variables) {
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Expo GraphQL HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error('Expo no autorizó o no pudo resolver la consulta de plan');
  return result.data;
}
const lookup = await query('query AccountByName($accountName: String!) { account { byName(accountName: $accountName) { id name } } }', { accountName: 'marketplacebrand' });
const account = lookup?.account?.byName;
if (!account?.id || account.name !== 'marketplacebrand') throw new Error('Cuenta Expo no identificada');
const data = await query(`query Usage($accountId: String!, $currentDate: DateTime!) {
  account { byId(accountId: $accountId) {
    name subscription { name status recurringCents }
    usageMetrics { byBillingPeriod(date: $currentDate, service: UPDATES) { planMetrics { serviceMetric value limit } } }
  } }
}`, { accountId: account.id, currentDate: new Date().toISOString() });
const result = data?.account?.byId;
if (!result?.subscription?.name) throw new Error('Plan Expo no disponible');
console.log(JSON.stringify({ account: result.name, subscription: result.subscription, updates: result.usageMetrics?.byBillingPeriod?.planMetrics ?? null }));
