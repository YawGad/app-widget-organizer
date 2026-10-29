import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

export function patchManifest(manifest) {
  let patched = manifest;
  if (!patched.includes('android.permission.QUERY_ALL_PACKAGES')) {
    const applicationTag = /(\s*<application\b)/;
    if (!applicationTag.test(patched)) throw new Error('AndroidManifest.xml has no application element.');
    patched = patched.replace(
      applicationTag,
      '\n    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />$1',
    );
  }

  const activityPattern = /<activity\b(?=[^>]*android:name="(?:[^"]*\.)?MainActivity")[^>]*>[\s\S]*?<\/activity>/m;
  const activity = patched.match(activityPattern);
  if (!activity) throw new Error('Could not find the generated MainActivity in AndroidManifest.xml.');

  const hasHomeFilter = [...activity[0].matchAll(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g)]
    .some(([filter]) => filter.includes('android.intent.action.MAIN')
      && filter.includes('android.intent.category.HOME')
      && filter.includes('android.intent.category.DEFAULT'));
  if (!hasHomeFilter) {
    const homeFilter = [
      '            <intent-filter>',
      '                <action android:name="android.intent.action.MAIN" />',
      '                <category android:name="android.intent.category.HOME" />',
      '                <category android:name="android.intent.category.DEFAULT" />',
      '            </intent-filter>',
      '        ',
    ].join('\n');
    patched = patched.replace(activityPattern, (match) => `${match.replace(/<\/activity>\s*$/, '')}\n${homeFilter}</activity>`);
  }
  return patched;
}

export function patchMainActivity(source) {
  const packageName = source.match(/^package ([^\n;]+);?$/m)?.[1]?.replace(/;$/, '');
  if (packageName !== 'com.organizer.app') {
    throw new Error(`Generated Android package "${packageName ?? 'unknown'}" does not match the maintained plugin package "com.organizer.app".`);
  }
  if (source.includes('registerPlugin(SmartLauncherPlugin')) return source;

  if (/public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{/.test(source)) {
    let patched = source;
    if (!/import android\.os\.Bundle;/.test(patched)) {
      patched = patched.replace(/^(package [^\n]+;)/m, '$1\n\nimport android.os.Bundle;');
    }
    const registration = 'registerPlugin(SmartLauncherPlugin.class);';
    const onCreatePattern = /(?:@Override\s*)?(?:public|protected)\s+void\s+onCreate\s*\(\s*Bundle\s+savedInstanceState\s*\)\s*\{([\s\S]*?)\n\s*\}/m;
    const onCreate = patched.match(onCreatePattern);
    if (onCreate) {
      if (!/super\.onCreate\s*\(savedInstanceState\)/.test(onCreate[1])) {
        throw new Error('Existing MainActivity.onCreate does not call super.onCreate(savedInstanceState).');
      }
      patched = patched.replace(onCreatePattern, (match) => match.replace(/(super\.onCreate\s*\(savedInstanceState\)\s*;)/m, `${registration}\n        $1`));
    } else {
      patched = patched.replace(
        /(public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{)/,
        `$1\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        ${registration}\n        super.onCreate(savedInstanceState);\n    }\n`,
      );
    }
    return patched;
  }

  const classPattern = /(class\s+MainActivity\s*:\s*BridgeActivity\s*\(\s*\)\s*\{)/;
  if (!classPattern.test(source)) throw new Error('Could not find a supported MainActivity : BridgeActivity() declaration.');
  let patched = source;
  if (!/import android\.os\.Bundle/.test(patched)) {
    patched = patched.replace(/^(package [^\n]+\n)/m, '$1\nimport android.os.Bundle\n');
  }
  const registration = 'registerPlugin(SmartLauncherPlugin::class.java)';
  const onCreatePattern = /override\s+fun\s+onCreate\s*\(\s*savedInstanceState\s*:\s*Bundle\?\s*\)\s*\{([\s\S]*?)\n\s*\}/m;
  const onCreate = patched.match(onCreatePattern);
  if (onCreate) {
    if (!/super\.onCreate\s*\(savedInstanceState\)/.test(onCreate[1])) {
      throw new Error('Existing MainActivity.onCreate does not call super.onCreate(savedInstanceState).');
    }
    patched = patched.replace(onCreatePattern, (match) => match.replace(/(super\.onCreate\s*\(savedInstanceState\))/m, `${registration}\n        $1`));
  } else {
    patched = patched.replace(
      classPattern,
      `$1\n    override fun onCreate(savedInstanceState: Bundle?) {\n        ${registration}\n        super.onCreate(savedInstanceState)\n    }\n`,
    );
  }
  return patched;
}

export function patchGradleBuilds(rootBuild, appBuild) {
  let patchedRoot = rootBuild;
  let patchedApp = appBuild;
  if (!patchedRoot.includes('kotlin-gradle-plugin')) {
    const androidPlugin = /classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"]/;
    if (!androidPlugin.test(patchedRoot)) throw new Error('Could not find the Android Gradle plugin dependency.');
    patchedRoot = patchedRoot.replace(androidPlugin, (match) => `${match}\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22'`);
  }
  if (!/apply plugin:\s*['"]kotlin-android['"]/.test(patchedApp)) {
    const androidApply = /apply plugin:\s*['"]com\.android\.application['"]/;
    if (!androidApply.test(patchedApp)) throw new Error('Could not find the Android application plugin declaration.');
    patchedApp = patchedApp.replace(androidApply, (match) => `${match}\napply plugin: 'kotlin-android'`);
  }
  return { rootBuild: patchedRoot, appBuild: patchedApp };
}

export async function patchAndroidProject(androidDirectory = path.join(repositoryRoot, 'android')) {
  const appDirectory = path.join(androidDirectory, 'app');
  const manifestPath = path.join(appDirectory, 'src', 'main', 'AndroidManifest.xml');
  const javaSourceDirectory = path.join(appDirectory, 'src', 'main', 'java', 'com', 'organizer', 'app');
  const javaActivityPath = path.join(javaSourceDirectory, 'MainActivity.java');
  const kotlinActivityPath = path.join(javaSourceDirectory, 'MainActivity.kt');
  const rootBuildPath = path.join(androidDirectory, 'build.gradle');
  const appBuildPath = path.join(appDirectory, 'build.gradle');
  const sourcePluginPath = path.join(repositoryRoot, 'android-native', 'com', 'organizer', 'app', 'SmartLauncherPlugin.kt');

  let mainActivityPath = javaActivityPath;
  let mainActivity;
  try {
    mainActivity = await readFile(mainActivityPath, 'utf8');
  } catch {
    mainActivityPath = kotlinActivityPath;
    try {
      mainActivity = await readFile(mainActivityPath, 'utf8');
    } catch (error) {
      throw new Error(`Android project is missing or incomplete. Run "npx cap add android" first. ${error.message}`);
    }
  }
  const [manifest, rootBuild, appBuild] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(rootBuildPath, 'utf8'),
    readFile(appBuildPath, 'utf8'),
  ]).catch((error) => {
    throw new Error(`Android project is missing or incomplete. Run "npx cap add android" first. ${error.message}`);
  });
  const pluginSource = await readFile(sourcePluginPath, 'utf8');
  const gradle = patchGradleBuilds(rootBuild, appBuild);

  await writeFile(manifestPath, patchManifest(manifest));
  await writeFile(mainActivityPath, patchMainActivity(mainActivity));
  await writeFile(rootBuildPath, gradle.rootBuild);
  await writeFile(appBuildPath, gradle.appBuild);
  await copyFile(sourcePluginPath, path.join(path.dirname(mainActivityPath), 'SmartLauncherPlugin.kt'));
  console.log('Patched Android HOME intent filters and registered SmartLauncherPlugin.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  patchAndroidProject().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
