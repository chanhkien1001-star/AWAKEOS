package os.awake.collector

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Salted SHA-256 of a package name (I-09).
 *
 *   packageNameHash = "sha256:" + base64url_nopad( SHA256( salt || utf8(packageName) ) )
 *
 * The 32-byte salt is generated once per install and stored in
 * EncryptedSharedPreferences (Android Keystore-backed). It never leaves the
 * device and is never synced, so a hash cannot be reversed to a package name off
 * the device even with a dictionary of known package ids.
 */
class PackageHasher(context: Context) {

    private val prefs by lazy {
        val key = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "awake_collector_salt",
            key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private val salt: ByteArray by lazy {
        prefs.getString(KEY_SALT, null)?.let { Base64.decode(it, Base64.NO_WRAP) } ?: run {
            val fresh = ByteArray(32).also { SecureRandom().nextBytes(it) }
            prefs.edit().putString(KEY_SALT, Base64.encodeToString(fresh, Base64.NO_WRAP)).apply()
            fresh
        }
    }

    fun hash(packageName: String): String {
        val digest = MessageDigest.getInstance("SHA-256").apply {
            update(salt)
            update(packageName.toByteArray(Charsets.UTF_8))
        }.digest()
        val b64 = Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        return "sha256:$b64"
    }

    private companion object {
        const val KEY_SALT = "package_hash_salt_v1"
    }
}
