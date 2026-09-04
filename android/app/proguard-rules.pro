# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# React Native
-keep class com.facebook.react.** { *; }
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <fields>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <fields>;
}

# Keep native module names
-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}