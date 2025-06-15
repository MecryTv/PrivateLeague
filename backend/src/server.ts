import Fastify from "fastify";

const fastify = Fastify({
  logger: true,
});

fastify.get("/", async (request, reply) => {
  return { message: "Hello World!" };
});

const start = async () => {
  try {
    await fastify.listen({
      port: 3000,
      host: "0.0.0.0",
    });

    console.log("🚀 Server läuft auf http://localhost:3000");
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};


process.on("SIGINT", () => {
  console.log("\n👋 Server wird beendet...");
  process.exit(0);
});

start();