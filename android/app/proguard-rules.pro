# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor: keep the WebView JavaScript bridge
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Capacitor Cordova compatibility layer
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# Keep JS interface classes for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
