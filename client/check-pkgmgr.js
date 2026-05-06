if (process.env.npm_execpath && !process.env.npm_execpath.includes("pnpm")) {
    console.log("[31m%s[0m", "⚠️  This project uses pnpm. Please run: pnpm install");
    process.exit(1);
  }
