plugins {
    id("com.android.application")
}

android {
    namespace = "com.samabusiness.wabridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.samabusiness.wabridge"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}
