function setupGracefulShutdown(bot) {
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down gracefully...");
      bot.stop();
      process.exit(0);
    });
  }
  
  module.exports = { setupGracefulShutdown };
  