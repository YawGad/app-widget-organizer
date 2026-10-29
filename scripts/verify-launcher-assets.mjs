import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function assertOrbitBundle(indexHtml, javascript) {
  if (!/<title>\s*Orbit Launcher\s*<\/title>/i.test(indexHtml)) {
    throw new Error('Production index.html does not identify Orbit Launcher.');
  }
  if (!javascript.includes('SMART AUTO-TIDY') || !javascript.includes('Clean &')) {
    throw new Error('Production JavaScript bundle is missing the Smart Auto-Tidy launcher interface.');
  }
  if (javascript.includes('Canvas Studio') || javascript.includes('Phone Screen Canvas Simulator')) {
    throw new Error('Production JavaScript bundle still contains the old simulator interface.');
  }
  const scriptPath = indexHtml.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/i)?.[1];
  if (!scriptPath) throw new Error('Production index.html does not reference a JavaScript bundle.');
  return scriptPath;
}

export async function verifyLauncherAssets(
  distributionDirectory = path.join(repositoryRoot, 'dist'),
  androidPublicDirectory = path.join(repositoryRoot, 'android', 'app', 'src', 'main', 'assets', 'public'),
) {
  const [distributionHtml, androidHtml, config] = await Promise.all([
    readFile(path.join(distributionDirectory, 'index.html'), 'utf8'),
    readFile(path.join(androidPublicDirectory, 'index.html'), 'utf8'),
    readFile(path.join(repositoryRoot, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json'), 'utf8'),
  ]);
  if (distributionHtml !== androidHtml) {
    throw new Error('Capacitor Android index.html differs from the current dist/index.html.');
  }

  const packageConfig = JSON.parse(config);
  if (packageConfig.appId !== 'com.organizer.app' || packageConfig.appName !== 'Orbit Launcher') {
    throw new Error('Synchronized Capacitor config does not identify com.organizer.app / Orbit Launcher.');
  }

  const scriptPath = distributionHtml.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/i)?.[1];
  if (!scriptPath) throw new Error('Production index.html does not reference a JavaScript bundle.');
  const bundlePath = scriptPath.replace(/^\/+/, '');
  const [distributionBundle, androidBundle] = await Promise.all([
    readFile(path.join(distributionDirectory, bundlePath)),
    readFile(path.join(androidPublicDirectory, bundlePath)),
  ]);
  if (!distributionBundle.equals(androidBundle)) {
    throw new Error(`Capacitor Android JavaScript bundle differs from dist/${bundlePath}.`);
  }
  const javascript = distributionBundle.toString('utf8');
  assertOrbitBundle(distributionHtml, javascript);

  const stylesheetPath = distributionHtml.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/i)?.[1];
  if (!stylesheetPath) throw new Error('Production index.html does not reference a stylesheet.');
  const stylesheet = stylesheetPath.replace(/^\/+/, '');
  const [distributionStylesheet, androidStylesheet] = await Promise.all([
    readFile(path.join(distributionDirectory, stylesheet)),
    readFile(path.join(androidPublicDirectory, stylesheet)),
  ]);
  if (!distributionStylesheet.equals(androidStylesheet)) {
    throw new Error(`Capacitor Android stylesheet differs from dist/${stylesheet}.`);
  }
  console.log('Verified Orbit Launcher title, Smart Auto-Tidy bundle, and byte-identical Android-synced JS/CSS assets.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  verifyLauncherAssets().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
