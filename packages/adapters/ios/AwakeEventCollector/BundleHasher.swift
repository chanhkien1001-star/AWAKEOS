import CryptoKit
import Foundation
import Security

/// Salted SHA-256 of a bundle identifier (I-09).
///
///   packageNameHash = "sha256:" + base64url_nopad( SHA256( salt || utf8(bundleId) ) )
///
/// The 32-byte salt is generated once and stored in the Keychain
/// (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, never synced to iCloud).
/// It never leaves the device.
struct BundleHasher {

    private let salt: Data

    init() {
        self.salt = BundleHasher.loadOrCreateSalt()
    }

    func hash(_ bundleId: String) -> String {
        var hasher = SHA256()
        hasher.update(data: salt)
        hasher.update(data: Data(bundleId.utf8))
        let digest = Data(hasher.finalize())
        let b64 = digest.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "sha256:\(b64)"
    }

    // MARK: - Keychain-backed salt

    private static let account = "os.awake.collector.packageHashSalt.v1"
    private static let service = "os.awake.collector"

    private static func loadOrCreateSalt() -> Data {
        if let existing = read() { return existing }
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let fresh = Data(bytes)
        write(fresh)
        return fresh
    }

    private static func read() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        return SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }

    private static func write(_ data: Data) {
        let item: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        SecItemDelete(item as CFDictionary)
        SecItemAdd(item as CFDictionary, nil)
    }
}
