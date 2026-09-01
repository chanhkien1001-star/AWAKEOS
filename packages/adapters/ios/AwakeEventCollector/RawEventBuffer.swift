import Foundation

/// Thread-safe bounded FIFO of RawEvents observed natively but not yet handed to
/// JS. On overflow the OLDEST entry is dropped. Backstop only — the module also
/// pushes batches as signals arrive.
final class RawEventBuffer {
    private var items: [RawEvent] = []
    private let capacity: Int
    private let queue = DispatchQueue(label: "os.awake.collector.buffer")

    init(capacity: Int = 4096) { self.capacity = capacity }

    func add(_ event: RawEvent) {
        queue.sync {
            if items.count >= capacity { items.removeFirst(items.count - capacity + 1) }
            items.append(event)
        }
    }

    func drain() -> [RawEvent] {
        queue.sync {
            let out = items
            items.removeAll(keepingCapacity: true)
            return out
        }
    }

    func size() -> Int { queue.sync { items.count } }
}
