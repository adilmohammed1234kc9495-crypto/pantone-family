# Retrofit and OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature
-keepattributes Exceptions
-keepattributes *Annotation*

# Gson
-keepattributes EnclosingMethod
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.pantone.fam.data.model.** { *; }

# ML Kit & CameraX
-keep class com.google.mlkit.** { *; }
-keep class androidx.camera.** { *; }
