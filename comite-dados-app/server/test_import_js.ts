async function test() {
  try {
    const lp = await import("./lineageParser.js");
    console.log("SUCCESS:", Object.keys(lp));
  } catch (err) {
    console.error("FAIL:", err);
  }
  process.exit(0);
}
test();
