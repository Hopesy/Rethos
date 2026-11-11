import groovy.json.JsonSlurper

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

val productVersion = (JsonSlurper().parse(rootProject.file("../package.json")) as Map<*, *>)["version"] as String
val versionParts = productVersion.split('.').map(String::toInt)
require(versionParts.size == 3 && versionParts[0] in 0..2000 && versionParts[1] in 0..999 && versionParts[2] in 0..999)

android {
    namespace = "cc.hopesy.rethos"
    compileSdk = 36
    defaultConfig {
        applicationId = "cc.hopesy.rethos"
        minSdk = 26
        targetSdk = 36
        versionCode = versionParts[0] * 1_000_000 + versionParts[1] * 1_000 + versionParts[2]
        versionName = productVersion
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        create("release") {
            System.getenv("RETHOS_ANDROID_KEYSTORE")?.let { storeFile = file(it) }
            storePassword = System.getenv("RETHOS_ANDROID_STORE_PASSWORD")
            keyAlias = System.getenv("RETHOS_ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("RETHOS_ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-debug" }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
    lint { abortOnError = true; checkReleaseBuilds = true }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-ktx:1.13.1")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test:rules:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
