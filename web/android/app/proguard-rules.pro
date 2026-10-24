# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep Capacitor Core and plugins
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keep public class * extends com.getcapacitor.BridgeActivity
-keep public class * extends com.getcapacitor.BridgeFragment

# Keep Javascript interfaces in WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX and Webkit interfaces
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-dontwarn com.google.android.gms.**
-dontwarn androidx.webkit.**
