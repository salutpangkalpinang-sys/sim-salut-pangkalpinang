import { Client } from "pg";

const passwords = [
  "SalutOwner#2026!Pgp",
  "suksesterus",
  "postgres",
];

const hosts = [
  "db.lcvcvlsmqkjovzwafdzz.supabase.co",
  "aws-0-ap-southeast-1.pooler.supabase.com",
];

async function main() {
  for (const host of hosts) {
    for (const pw of passwords) {
      const connStr = `postgres://postgres:${encodeURIComponent(pw)}@${host}:5432/postgres`;
      console.log(`Trying host: ${host} with pw...`);
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        console.log(` SUCCESS CONNECTING TO ${host}!`);
        await client.end();
        return;
      } catch (err: any) {
        console.log(` Failed (${err.message})`);
      }
    }
  }
}

main().catch(console.error);
