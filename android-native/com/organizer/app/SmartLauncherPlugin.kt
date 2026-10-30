package com.organizer.app

import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.provider.Settings
import android.util.Base64
import android.util.LruCache
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.ByteArrayOutputStream

@CapacitorPlugin(name = "SmartLauncher")
class SmartLauncherPlugin : Plugin() {
    private var packageReceiver: BroadcastReceiver? = null
    private val iconCache = object : LruCache<String, String>(8 * 1024) {
        override fun sizeOf(key: String, value: String): Int = value.length / 1024 + 1
    }

    override fun load() {
        super.load()
        registerPackageReceiver()
    }

    override fun handleOnResume() {
        super.handleOnResume()
        notifyListeners("inventoryRefresh", JSObject())
    }

    override fun handleOnDestroy() {
        unregisterPackageReceiver()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun getInstalledApps(call: PluginCall) {
        try {
            val packageManager = activity.packageManager
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val activities = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.queryIntentActivities(launcherIntent, PackageManager.ResolveInfoFlags.of(0))
            } else {
                packageManager.queryIntentActivities(launcherIntent, 0)
            }
            val uniqueApps = activities
                .mapNotNull { it.activityInfo?.applicationInfo }
                .distinctBy { it.packageName }
                .map { applicationInfo ->
                    val label = packageManager.getApplicationLabel(applicationInfo).toString()
                    val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        packageManager.getPackageInfo(
                            applicationInfo.packageName,
                            PackageManager.PackageInfoFlags.of(0),
                        )
                    } else {
                        packageManager.getPackageInfo(applicationInfo.packageName, 0)
                    }
                    val icon = cachedIconDataUri(applicationInfo.packageName, packageInfo.lastUpdateTime) {
                        val drawable = packageManager.getApplicationIcon(applicationInfo)
                        val size = 96
                        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(bitmap)
                        drawable.setBounds(0, 0, size, size)
                        drawable.draw(canvas)
                        val output = ByteArrayOutputStream()
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
                        bitmap.recycle()
                        "data:image/png;base64,${Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)}"
                    }
                    Triple(applicationInfo.packageName, label, icon)
                }
                .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.second })

            val appArray = JSArray()
            uniqueApps.forEach { (packageName, label, icon) ->
                appArray.put(JSObject().apply {
                    put("packageName", packageName)
                    put("label", label)
                    put("iconDataUri", icon)
                })
            }
            call.resolve(JSObject().put("apps", appArray))
        } catch (exception: Exception) {
            call.reject("Unable to read launchable applications.", exception)
        }
    }

    @PluginMethod
    fun launchApp(call: PluginCall) {
        val packageName = call.getString("packageName")
        if (packageName.isNullOrBlank()) {
            call.reject("A packageName is required.")
            return
        }
        try {
            val launchIntent = activity.packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent == null) {
                call.reject("No launch intent is available for $packageName.")
                return
            }
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(launchIntent)
            call.resolve()
        } catch (exception: ActivityNotFoundException) {
            call.reject("The application is no longer available.", exception)
        } catch (exception: SecurityException) {
            call.reject("Android denied the application launch.", exception)
        } catch (exception: RuntimeException) {
            call.reject("Android could not launch the application.", exception)
        }
    }

    @PluginMethod
    fun getDefaultLauncherStatus(call: PluginCall) {
        try {
            val packageManager = activity.packageManager
            val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            val defaultHome = packageManager.resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            call.resolve(JSObject().put("isDefault", defaultHome?.activityInfo?.packageName == context.packageName))
        } catch (exception: RuntimeException) {
            call.reject("Unable to determine the selected Home app.", exception)
        }
    }

    @PluginMethod
    fun openDefaultLauncherSettings(call: PluginCall) {
        val settingsIntents = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            listOf(
                Intent(Settings.ACTION_HOME_SETTINGS),
                Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
            )
        } else {
            listOf(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
        }
        for (intent in settingsIntents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                activity.startActivity(intent)
                call.resolve()
                return
            } catch (_: ActivityNotFoundException) {
                // Try the next system settings route.
            } catch (exception: SecurityException) {
                call.reject("Android denied access to Home-app settings.", exception)
                return
            } catch (exception: RuntimeException) {
                call.reject("Android could not open Home-app settings.", exception)
                return
            }
        }
        call.reject("This Android version does not expose Home-app settings.")
    }

    private fun cachedIconDataUri(packageName: String, lastUpdateTime: Long, create: () -> String): String {
        val key = "$packageName:$lastUpdateTime"
        return iconCache.get(key) ?: create().also { iconCache.put(key, it) }
    }

    private fun registerPackageReceiver() {
        if (packageReceiver != null) return
        val filter = IntentFilter(Intent.ACTION_PACKAGE_REMOVED).apply {
            addDataScheme("package")
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(receiverContext: Context, intent: Intent) {
                if (intent.action != Intent.ACTION_PACKAGE_REMOVED || intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)) return
                val packageName = intent.data?.schemeSpecificPart ?: return
                notifyListeners("packageRemoved", JSObject().put("packageName", packageName))
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
        packageReceiver = receiver
    }

    private fun unregisterPackageReceiver() {
        val receiver = packageReceiver ?: return
        try {
            context.unregisterReceiver(receiver)
        } catch (exception: IllegalArgumentException) {
            // The receiver was already removed by Android during activity teardown.
        } finally {
            packageReceiver = null
        }
    }
}
