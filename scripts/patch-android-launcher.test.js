import test from 'node:test';
import assert from 'node:assert/strict';
import { patchGradleBuilds, patchMainActivity, patchManifest } from './patch-android-launcher.mjs';

const manifestFixture = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application>
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

test('adds package visibility and a separate HOME filter without removing the app-drawer filter', () => {
  const result = patchManifest(manifestFixture);
  assert.match(result, /android\.permission\.QUERY_ALL_PACKAGES/);
  assert.match(result, /android\.intent\.category\.HOME/);
  assert.match(result, /android\.intent\.category\.DEFAULT/);
  assert.match(result, /android\.intent\.category\.LAUNCHER/);
});

test('manifest patch is idempotent', () => {
  const once = patchManifest(manifestFixture);
  const twice = patchManifest(once);
  assert.equal(twice, once);
  assert.equal((twice.match(/QUERY_ALL_PACKAGES/g) || []).length, 1);
  assert.equal((twice.match(/android\.intent\.category\.HOME/g) || []).length, 1);
});

test('registers the plugin before the Capacitor activity is created and is idempotent', () => {
  const source = 'package com.organizer.app;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n';
  const once = patchMainActivity(source);
  assert.match(once, /import android\.os\.Bundle;/);
  assert.ok(once.indexOf('registerPlugin(SmartLauncherPlugin.class)') < once.indexOf('super.onCreate(savedInstanceState)'));
  assert.equal(patchMainActivity(once), once);
});

test('rejects generated projects with an unexpected Android package', () => {
  const source = 'package unexpected.package;\npublic class MainActivity extends BridgeActivity {}';
  assert.throws(() => patchMainActivity(source), /does not match/);
});

test('enables Kotlin compilation exactly once in the generated Android project', () => {
  const rootBuild = `buildscript {
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.1'
    }
}`;
  const appBuild = `apply plugin: 'com.android.application'\nandroid {}`;
  const first = patchGradleBuilds(rootBuild, appBuild);
  const second = patchGradleBuilds(first.rootBuild, first.appBuild);
  assert.equal(first.rootBuild.match(/kotlin-gradle-plugin/g)?.length, 1);
  assert.equal(first.appBuild.match(/kotlin-android/g)?.length, 1);
  assert.deepEqual(second, first);
});
