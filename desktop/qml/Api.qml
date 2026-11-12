pragma Singleton
import QtQuick

// Talks to the Worker, which has the scrobble history. Mirrors the helpers in ../../app.js.
QtObject {
    readonly property string base: "https://lastfm-stats.kzn-intranet.workers.dev"
    readonly property var periods: [
        { id: "7d", label: "7 days", days: 7 },
        { id: "30d", label: "30 days", days: 30 },
        { id: "90d", label: "3 months", days: 90 },
        { id: "180d", label: "6 months", days: 180 },
        { id: "365d", label: "12 months", days: 365 },
        { id: "all", label: "All time", days: 0 },
        { id: "custom", label: "Custom", days: 0 }
    ]
    property var cache: ({})

    // callback(data, error). Cached data arrives at once and is refreshed when it is
    // `live` or over a minute old; an error is only reported if there was nothing cached.
    function load(path, callback, live) {
        const hit = cache[path]
        if (hit)
            callback(hit.data, "")
        if (hit && !live && Date.now() - hit.at < 60000)
            return
        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== XMLHttpRequest.DONE)
                return
            let data = null
            try { data = JSON.parse(xhr.responseText) } catch (e) {}
            if (xhr.status === 200 && data) {
                cache[path] = { data: data, at: Date.now() }
                callback(data, "")
            } else if (!hit) {
                callback(null, data && data.error ? data.error : "no connection")
            }
        }
        xhr.open("GET", base + path)
        xhr.send()
    }

    function parseDate(text) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
    }

    // The period as { from, to, days }, or null while a custom range is incomplete.
    // Presets start at local midnight, so "7 days" is exactly 7 bars.
    function range(periodId, fromText, toText) {
        const period = periods.find(p => p.id === periodId) || periods[1]
        const now = new Date()
        if (period.days)
            return { from: Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate() - period.days + 1) / 1000), to: 0, days: period.days }
        if (period.id === "custom") {
            const from = parseDate(fromText)
            const to = parseDate(toText)
            if (!from || !to || from > to)
                return null
            to.setDate(to.getDate() + 1)
            return { from: Math.floor(from / 1000), to: Math.floor(to / 1000), days: Math.round((to - from) / 864e5) }
        }
        return { from: 0, to: 0, days: 0 }
    }

    function bucketFor(days) {
        return days === 0 || days > 366 ? "month" : days > 31 ? "week" : "day"
    }

    function query(r) {
        return "from=" + r.from + (r.to ? "&to=" + r.to : "")
    }

    function num(n) {
        return Number(n).toLocaleString(Qt.locale("en_US"), "f", 0)
    }

    function bucketLabel(key, bucket) {
        const date = parseDate(key.length === 7 ? key + "-01" : key)
        if (bucket === "month")
            return Qt.formatDate(date, "MMM yyyy")
        return bucket === "week" ? "Week of " + Qt.formatDate(date, "d MMM yyyy") : Qt.formatDate(date, "ddd d MMM yyyy")
    }
}
