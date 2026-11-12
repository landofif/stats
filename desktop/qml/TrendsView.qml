import QtCore
import QtQuick
import QtQuick.Controls.Basic

// Scrobbles over time and a weekday x hour listening clock.
Item {
    id: view
    property string path: ""
    property string message: ""
    property string bucket: "day"
    property int days: 0
    property int plays: 0
    property var buckets: []
    property var clock: []       // 7 rows (Sunday first) of 24 hours
    property int max: 1
    property int clockMax: 1
    property int peak: 0
    property int hoverBar: -1
    property int hoverCell: -1   // dow * 24 + hour
    readonly property var dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    readonly property var dayOrder: [1, 2, 3, 4, 5, 6, 0]

    Settings {
        category: "trends"
        property alias period: periods.period
        property alias from: periods.fromText
        property alias to: periods.toText
    }

    function hourText(hour) {
        return String(hour).padStart(2, "0") + ":00"
    }

    function reload() {
        const r = periods.range
        if (!r) {
            view.plays = 0
            view.path = ""
            view.message = "Type a start and an end date, like 2026-01-31."
            return
        }
        const bucket = Api.bucketFor(r.days)
        const path = "/trends?bucket=" + bucket + "&" + Api.query(r)
        if (path !== view.path) {
            view.plays = 0
            view.message = "Loading…"
        }
        view.path = path
        Api.load(path, function (data, error) {
            if (path !== view.path)
                return // an answer for a selection that has since changed
            if (!data || !data.plays) {
                view.plays = 0
                view.message = data ? "Nothing in this period." : "Could not load: " + error
                return
            }
            const byHour = []
            for (let hour = 0; hour < 24; hour++)
                byHour.push(data.clock.reduce((sum, row) => sum + row[hour], 0))
            view.hoverBar = -1
            view.hoverCell = -1
            view.bucket = bucket
            // All time has no fixed length: count from the first bucket to today.
            view.days = r.days || Math.max(1, Math.round((Date.now() - Api.parseDate(data.buckets[0].key + "-01")) / 864e5))
            view.max = Math.max(...data.buckets.map(b => b.plays))
            view.clockMax = Math.max(...data.clock.map(row => Math.max(...row)))
            view.peak = byHour.indexOf(Math.max(...byHour))
            view.buckets = data.buckets
            view.clock = data.clock
            view.plays = data.plays
            view.message = ""
        })
    }
    onVisibleChanged: if (visible) reload()
    Component.onCompleted: reload()

    component Card: Rectangle {
        default property alias content: inner.data
        property string title
        width: parent.width
        height: inner.height + 28
        radius: 14
        color: Theme.card
        Column {
            id: inner
            x: 14
            y: 14
            width: parent.width - 28
            spacing: 8
            Text { text: title.toUpperCase(); color: Theme.muted; font.pixelSize: 12; font.weight: Font.DemiBold; font.letterSpacing: 0.5 }
        }
    }
    component Tile: Rectangle {
        property string value
        property string label
        width: 150
        height: 62
        radius: 14
        color: Theme.card
        Column {
            x: 12
            anchors.verticalCenter: parent.verticalCenter
            Text { text: value; color: Theme.text; font.pixelSize: 20; font.bold: true }
            Text { text: label; color: Theme.muted; font.pixelSize: 12 }
        }
    }

    PeriodBar {
        id: periods
        width: parent.width
        onRangeChanged: view.reload()
    }

    Text {
        anchors.centerIn: scroll
        visible: view.message !== ""
        text: view.message
        color: Theme.muted
    }

    Flickable {
        id: scroll
        anchors { top: periods.bottom; topMargin: 14; left: parent.left; right: parent.right; bottom: parent.bottom }
        clip: true
        contentHeight: content.height
        boundsBehavior: Flickable.StopAtBounds
        visible: view.plays > 0
        ScrollBar.vertical: ScrollBar {}

        Column {
            id: content
            width: scroll.width
            spacing: 12

            Row {
                spacing: 8
                Tile { value: Api.num(view.plays); label: "Scrobbles" }
                Tile { value: (view.plays / Math.max(1, view.days)).toFixed(1); label: "Per day" }
                Tile { value: view.hourText(view.peak); label: "Peak hour" }
            }

            Card {
                title: "Scrobbles per " + view.bucket
                // Hovering a bar shows its value here.
                Text {
                    color: Theme.text
                    font.pixelSize: 14
                    textFormat: Text.StyledText
                    text: view.hoverBar >= 0 && view.hoverBar < view.buckets.length
                        ? Api.bucketLabel(view.buckets[view.hoverBar].key, view.bucket) + ": <b>" + Api.num(view.buckets[view.hoverBar].plays) + "</b>"
                        : "Most in one " + view.bucket + ": " + Api.num(view.max)
                }
                Row {
                    id: bars
                    width: parent.width
                    height: 180
                    spacing: 2
                    Repeater {
                        model: view.buckets
                        Item {
                            required property var modelData
                            required property int index
                            width: (bars.width - bars.spacing * (view.buckets.length - 1)) / view.buckets.length
                            height: bars.height
                            Rectangle {
                                anchors.bottom: parent.bottom
                                width: parent.width
                                height: Math.max(1, parent.height * modelData.plays / view.max)
                                topLeftRadius: Math.min(4, width / 2)
                                topRightRadius: Math.min(4, width / 2)
                                color: Theme.accent
                                opacity: view.hoverBar === index ? 1 : 0.75
                            }
                            HoverHandler {
                                onHoveredChanged: view.hoverBar = hovered ? index : view.hoverBar === index ? -1 : view.hoverBar
                            }
                        }
                    }
                }
                Rectangle { width: parent.width; height: 1; color: Theme.line }
                Item {
                    width: parent.width
                    height: 16
                    Text { text: view.buckets.length ? Api.bucketLabel(view.buckets[0].key, view.bucket) : ""; color: Theme.muted; font.pixelSize: 12 }
                    Text { anchors.right: parent.right; text: view.buckets.length ? Api.bucketLabel(view.buckets[view.buckets.length - 1].key, view.bucket) : ""; color: Theme.muted; font.pixelSize: 12 }
                }
            }

            Card {
                title: "When you listen"
                Text {
                    readonly property int dow: Math.floor(view.hoverCell / 24)
                    readonly property int hour: view.hoverCell % 24
                    color: Theme.text
                    font.pixelSize: 14
                    textFormat: Text.StyledText
                    text: view.hoverCell >= 0 && view.clock.length === 7
                        ? view.dayNames[dow] + " " + view.hourText(hour) + ": <b>" + Api.num(view.clock[dow][hour]) + "</b>"
                        : "Busiest hour: " + view.hourText(view.peak)
                }
                Grid {
                    id: grid
                    readonly property real cell: Math.min(26, (parent.width - 40 - 23 * 2) / 24)
                    columns: 25
                    spacing: 2
                    verticalItemAlignment: Grid.AlignVCenter
                    Repeater {
                        model: view.clock.length === 7 ? 7 * 25 : 0
                        Item {
                            required property int index
                            readonly property int dow: view.dayOrder[Math.floor(index / 25)]
                            readonly property int hour: index % 25 - 1
                            readonly property int plays: hour >= 0 ? view.clock[dow][hour] : 0
                            width: hour < 0 ? 38 : grid.cell
                            height: grid.cell
                            Text { visible: hour < 0; anchors.verticalCenter: parent.verticalCenter; text: view.dayNames[dow]; color: Theme.muted; font.pixelSize: 11 }
                            // One hue, light to dark; empty hours keep the neutral colour.
                            Rectangle { visible: hour >= 0; anchors.fill: parent; radius: 3; color: Theme.line }
                            Rectangle {
                                visible: hour >= 0 && plays > 0
                                anchors.fill: parent
                                radius: 3
                                color: Theme.accent
                                opacity: 0.15 + 0.85 * plays / view.clockMax
                            }
                            Rectangle {
                                visible: hour >= 0 && view.hoverCell === dow * 24 + hour
                                anchors.fill: parent
                                radius: 3
                                color: "transparent"
                                border.color: Theme.text
                                border.width: 2
                            }
                            HoverHandler {
                                enabled: hour >= 0
                                onHoveredChanged: {
                                    const id = dow * 24 + hour
                                    view.hoverCell = hovered ? id : view.hoverCell === id ? -1 : view.hoverCell
                                }
                            }
                        }
                    }
                    Item { width: 38; height: 14 }
                    Repeater {
                        model: 24
                        Text {
                            required property int index
                            width: grid.cell
                            text: index % 6 === 0 ? String(index).padStart(2, "0") : ""
                            color: Theme.muted
                            font.pixelSize: 11
                        }
                    }
                }
            }
        }
    }
}
