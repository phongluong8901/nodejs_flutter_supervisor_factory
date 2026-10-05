plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.example.my_proj_2"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // 1. Kích hoạt tính năng hỗ trợ thư viện Java 8+
        isCoreLibraryDesugaringEnabled = true

        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "com.example.my_proj_2"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        
        // 2. Cho phép gộp nhiều file Dex để không bị quá tải phương thức
        multiDexEnabled = true
    }

    buildTypes {
        getByName("release") {
            // Lưu ý: Đang dùng cấu hình debug để bạn build thử
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // 3. Thư viện cầu nối giúp chạy Java 8 trên Android cũ
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.3")
}