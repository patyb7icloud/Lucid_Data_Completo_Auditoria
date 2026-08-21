const { Client } = require("pg");

async function run() {
  const client = new Client({
    connectionString: "postgresql://comite_user:senha_segura@localhost:5433/comite_dados"
  });

  try {
    await client.connect();
    await client.query(`
      ALTER TABLE intake_requests 
      ADD COLUMN "submitterName" varchar(128),
      ADD COLUMN "submitterEmail" varchar(128),
      ADD COLUMN "submitterPhone" varchar(32),
      ADD COLUMN "keyUser" varchar(128),
      ADD COLUMN "bpResponsible" varchar(128),
      ADD COLUMN "involvedAreas" text;
    `);
    console.log("Success");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("Columns already exist, ignoring.");
    } else {
      console.error(err);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

run();
