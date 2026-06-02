import { Client } from 'pg';

const url = 'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function runTest() {
  const client = new Client({ connectionString: url });
  await client.connect();

  const res = await client.query('SELECT id, status, "actualSoldAmount", "settledAt" FROM orders');
  const allOrders = res.rows;

  const safeNum = (val: any) => {
    const n = Number(val);
    return isFinite(n) ? n : 0;
  };

  const OrderStatus = {
    SETTLED: 'SETTLED',
    PARTIAL_DUE: 'PARTIAL_DUE',
    MANUAL_DUE: 'MANUAL_DUE',
  };

  const last7Days = [];
  const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
  const startOfTodayBD = new Date(new Date().getTime() + BD_OFFSET_MS);
  startOfTodayBD.setUTCHours(0,0,0,0);

  console.log(`startOfTodayBD: ${startOfTodayBD.toISOString()}`);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfTodayBD.getTime() - i * 24 * 60 * 60 * 1000);
    const dStart = new Date(d.getTime() - BD_OFFSET_MS);
    const dEnd = new Date(dStart.getTime() + 24 * 60 * 60 * 1000);

    console.log(`Day ${6-i}: date BD: ${d.toISOString()} | dStart UTC: ${dStart.toISOString()} | dEnd UTC: ${dEnd.toISOString()}`);

    const daySales = allOrders.filter(o => {
      const settled = o.settledAt ? new Date(o.settledAt) : null;
      return [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE, OrderStatus.MANUAL_DUE].includes(o.status) &&
             settled && settled >= dStart && settled < dEnd;
    }).reduce((sum, o) => sum + safeNum(o.actualSoldAmount), 0);

    last7Days.push({
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Dhaka' }),
      amount: daySales
    });
  }

  console.log('\n--- CHART DATA ---');
  console.log(JSON.stringify(last7Days, null, 2));

  await client.end();
}

runTest().catch(console.error);
