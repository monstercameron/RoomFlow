import "dotenv/config";
import { getBoss, registerWorkerHandlers } from "../src/lib/jobs";

async function main() {
  const boss = await registerWorkerHandlers();

  const shutdown = async () => {
    await boss.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Roomflow worker online");
}

main().catch(async (error) => {
  console.error(error);

  try {
    const boss = await getBoss();
    await boss.stop();
  } catch {
    // noop
  }

  process.exit(1);
});
