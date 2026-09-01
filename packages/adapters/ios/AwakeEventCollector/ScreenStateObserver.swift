import UIKit

/// Observes screen lock/unlock and display on/off, emitting `ScreenStateChanged`
/// RawEvents. No permission required.
///
/// iOS has no public "screen on/off" notification, so we approximate:
///  - `protectedDataDidBecomeAvailable`   -> "Unlocked"
///  - `protectedDataWillBecomeUnavailable`-> "Locked"
///  - `UIScreen.brightnessDidChange` to 0 -> "Off";  from 0 -> "On"
///
/// I-02: only the transition is reported.
final class ScreenStateObserver {

    private let onEvent: (RawEvent) -> Void
    private var observers: [NSObjectProtocol] = []
    private var lastBrightnessWasZero = false

    init(onEvent: @escaping (RawEvent) -> Void) {
        self.onEvent = onEvent
    }

    func start() {
        let nc = NotificationCenter.default

        observers.append(nc.addObserver(
            forName: UIApplication.protectedDataDidBecomeAvailableNotification, object: nil, queue: .main
        ) { [weak self] _ in self?.onEvent(.screen("Unlocked", nowMs())) })

        observers.append(nc.addObserver(
            forName: UIApplication.protectedDataWillBecomeUnavailableNotification, object: nil, queue: .main
        ) { [weak self] _ in self?.onEvent(.screen("Locked", nowMs())) })

        lastBrightnessWasZero = UIScreen.main.brightness <= 0.001
        observers.append(nc.addObserver(
            forName: UIScreen.brightnessDidChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            let isZero = UIScreen.main.brightness <= 0.001
            if isZero != self.lastBrightnessWasZero {
                self.onEvent(.screen(isZero ? "Off" : "On", nowMs()))
                self.lastBrightnessWasZero = isZero
            }
        })
    }

    func stop() {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
    }
}
