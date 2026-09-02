package os.awake.collector

import java.util.ArrayDeque

/**
 * Thread-safe bounded FIFO of RawEvents observed on the native side but not yet
 * handed to JS. Drains via `drainPendingEvents()`. On overflow the OLDEST entry
 * is dropped (never the newest) so a burst never loses the most recent signal.
 *
 * This is only a backstop for signals observed while the JS side was asleep; the
 * module also pushes batches as they arrive.
 */
class RawEventBuffer(private val capacity: Int = 4096) {

    private val queue = ArrayDeque<RawEvent>()
    private val lock = Any()

    fun add(event: RawEvent) {
        synchronized(lock) {
            while (queue.size >= capacity) queue.pollFirst()
            queue.addLast(event)
        }
    }

    fun drain(): List<RawEvent> = synchronized(lock) {
        val out = ArrayList<RawEvent>(queue.size)
        out.addAll(queue)
        queue.clear()
        out
    }

    fun size(): Int = synchronized(lock) { queue.size }
}
