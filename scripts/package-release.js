const { mkdirSync, rmSync } = require("fs");
const { execFileSync } = require("child_process");
const { join } = require("path");
const manifest = require("../manifest.json");

const projectRoot = join(__dirname, "..");
const releaseDir = join(projectRoot, "release");
const zipName = `rare-word-keeper-v${manifest.version}.zip`;
const zipPath = join(releaseDir, zipName);
const files = [
  "manifest.json",
  "background.js",
  "content.js",
  "content.css",
  "popup.html",
  "popup.js",
  "popup.css",
  "README.md",
  "RELEASE_NOTES.md",
  "LICENSE"
];

mkdirSync(releaseDir, { recursive: true });
rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", zipPath, ...files], {
  cwd: projectRoot,
  stdio: "inherit"
});

console.log(`Created ${zipPath}`);
